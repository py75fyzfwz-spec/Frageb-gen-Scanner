import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages/messages";
import {
  EXTRAKTION_SCHEMA,
  SYSTEM_PROMPT,
  USER_PROMPT,
  type Extraktion,
} from "./fragebogen";
import type { Ergebnis } from "./claude-typen";

// Der API-Schlüssel kommt nur aus der Server-Umgebung (Vercel: Environment Variables).
export const client = new Anthropic();

export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const EFFORT = (process.env.CLAUDE_EFFORT || "low") as Effort;

/** Für Tests ohne API-Schlüssel: MOCK_CLAUDE=1 liefert erfundene Antworten. */
export const MOCK = process.env.MOCK_CLAUDE === "1";

/** Hochgeladene Seiten werden bei Anthropic nach dieser Zeit automatisch gelöscht. */
export const FILE_TTL_SECONDS = 7 * 24 * 3600;

/** Anfrage für eine Seite (für Direktaufruf und Sammelauftrag gleich). */
export function seitenAnfrage(fileId: string): MessageCreateParamsNonStreaming {
  return {
    model: MODEL,
    max_tokens: 16000,
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "file", file_id: fileId } },
          { type: "text", text: USER_PROMPT },
        ],
      },
    ],
    output_config: {
      effort: EFFORT,
      format: { type: "json_schema", schema: EXTRAKTION_SCHEMA as unknown as Record<string, unknown> },
    },
  };
}

export type { Ergebnis };

interface AntwortTeil {
  stop_reason: string | null;
  content: Array<{ type: string; text?: string }>;
}

/** Liest Claudes Antwort aus und prüft, ob sie vollständig ist. */
export function antwortAuswerten(msg: AntwortTeil): Ergebnis {
  if (msg.stop_reason === "refusal") {
    return { ok: false, fehler: "Claude hat die Seite abgelehnt.", wiederholbar: false };
  }
  if (msg.stop_reason === "max_tokens") {
    return { ok: false, fehler: "Antwort war zu lang und wurde abgeschnitten.", wiederholbar: true };
  }
  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  try {
    return { ok: true, daten: JSON.parse(text) as Extraktion };
  } catch {
    return { ok: false, fehler: "Antwort war kein gültiges JSON.", wiederholbar: true };
  }
}

export function mockExtraktion(seed: string): Extraktion {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const n = (k: number) => String(((h >>> k) % 3) + 1) as "1" | "2" | "3";
  return {
    ist_fragebogen: true,
    kopf: { veranstaltungsort: "Festhalle Brühl", datum: "04.11.2026", film: "Dancing Queens" },
    novize: h % 2 ? "ja" : "nein",
    freq: h % 2 ? "" : String((h % 5) + 2),
    film: n(1),
    talk: "",
    veranst: n(3),
    fest: n(5),
    wieder: "ja",
    nwieder: "",
    notiz: h % 4 === 0 ? "Schöner Abend, gerne wieder!" : "",
    age: String(55 + (h % 30)),
    sex: h % 3 ? "frau" : "mann",
    unsicher: h % 5 === 0 ? ["film"] : [],
    hinweis: h % 5 === 0 ? "Film: Kreuz zwischen 1 und 2 (Testdaten)" : "",
  };
}

/** Wandelt SDK-Fehler in eine verständliche Meldung um. */
export function fehlerText(err: unknown): { text: string; status: number } {
  if (err instanceof Anthropic.AuthenticationError) {
    return { text: "Der API-Schlüssel ist ungültig. Bitte ANTHROPIC_API_KEY in Vercel prüfen.", status: 500 };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { text: "Zu viele Anfragen gleichzeitig. Bitte kurz warten und erneut versuchen.", status: 429 };
  }
  if (err instanceof Anthropic.BadRequestError) {
    return { text: "Anfrage abgelehnt: " + err.message, status: 400 };
  }
  if (err instanceof Anthropic.APIError) {
    return { text: "Fehler bei Claude: " + err.message, status: err.status ?? 502 };
  }
  if (err instanceof Error) return { text: err.message, status: 500 };
  return { text: "Unbekannter Fehler", status: 500 };
}
