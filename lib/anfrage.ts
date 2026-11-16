// Gemeinsam für Server (Vercel) und reine Browser-Version (GitHub Pages).
import type { ImageBlockParam, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages/messages";
import { EXTRAKTION_SCHEMA, SYSTEM_PROMPT, USER_PROMPT, type Extraktion } from "./fragebogen";
import type { Ergebnis } from "./claude-typen";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/** Hochgeladene Seiten werden bei Anthropic nach dieser Zeit automatisch gelöscht. */
export const FILE_TTL_SECONDS = 7 * 24 * 3600;

/** Anfrage für eine Seite (für Direktaufruf und Sammelauftrag gleich). */
/** bild: Datei-ID aus der Files API oder das Bild selbst (Base64-JPEG). */
export function baueAnfrage(
  bild: { fileId: string } | { base64: string },
  model: string,
  effort: Effort,
): MessageCreateParamsNonStreaming {
  const source: ImageBlockParam["source"] =
    "fileId" in bild
      ? { type: "file", file_id: bild.fileId }
      : { type: "base64", media_type: "image/jpeg", data: bild.base64 };
  return {
    model,
    max_tokens: 16000,
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source },
          { type: "text", text: USER_PROMPT },
        ],
      },
    ],
    output_config: {
      effort,
      format: { type: "json_schema", schema: EXTRAKTION_SCHEMA as unknown as Record<string, unknown> },
    },
  };
}


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

