import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Extraktion } from "./fragebogen";
import type { Ergebnis } from "./claude-typen";
import { baueAnfrage, type Effort } from "./anfrage";

// Der API-Schlüssel kommt nur aus der Server-Umgebung (Vercel: Environment Variables).
export const client = new Anthropic();

export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
const EFFORT = (process.env.CLAUDE_EFFORT || "low") as Effort;

/** Für Tests ohne API-Schlüssel: MOCK_CLAUDE=1 liefert erfundene Antworten. */
export const MOCK = process.env.MOCK_CLAUDE === "1";

export { antwortAuswerten, FILE_TTL_SECONDS } from "./anfrage";
export type { Ergebnis };

/** Anfrage für eine Seite (für Direktaufruf und Sammelauftrag gleich). */
export function seitenAnfrage(fileId: string) {
  return baueAnfrage({ fileId }, MODEL, EFFORT);
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
