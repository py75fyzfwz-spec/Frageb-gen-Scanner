// Reine Browser-Version (GitHub Pages): beantwortet die /api/...-Aufrufe der Oberfläche direkt im Browser.
// Der API-Schlüssel wird vom Nutzer eingegeben und nur in diesem Browser gespeichert.
// Files API und Batches erlauben keine Aufrufe aus dem Browser (CORS), deshalb:
// Bilder bleiben im Arbeitsspeicher und gehen direkt mit der Anfrage mit; kein Sammelauftrag.
import Anthropic from "@anthropic-ai/sdk";
import { antwortAuswerten, baueAnfrage } from "./anfrage";

const bilder = new Map<string, string>(); // lokale ID -> Base64-JPEG
let zaehler = 0;

async function base64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export const SCHLUESSEL_SPEICHER = "fragebogen-api-key";
const MODEL = "claude-opus-5-5";

export function schluessel(): string {
  try {
    return localStorage.getItem(SCHLUESSEL_SPEICHER) ?? "";
  } catch {
    return "";
  }
}

function client() {
  const apiKey = schluessel();
  if (!apiKey) throw new Error("Bitte zuerst oben den API-Schlüssel eingeben.");
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

const antwort = (daten: unknown, status = 200) =>
  new Response(JSON.stringify(daten), { status, headers: { "content-type": "application/json" } });

function fehler(err: unknown) {
  if (err instanceof Anthropic.AuthenticationError) return antwort({ fehler: "Der API-Schlüssel ist ungültig." }, 400);
  if (err instanceof Anthropic.RateLimitError) return antwort({ fehler: "Zu viele Anfragen, bitte kurz warten." }, 429);
  if (err instanceof Anthropic.APIError) return antwort({ fehler: "Fehler bei Claude: " + err.message }, err.status ?? 502);
  return antwort({ fehler: err instanceof Error ? err.message : String(err) }, 400);
}


export async function direktApi(url: string, init?: RequestInit): Promise<Response> {
  try {
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;

    if (url === "/api/upload") {
      if (!schluessel()) throw new Error("Bitte zuerst oben den API-Schlüssel eingeben.");
      const bild = (init!.body as FormData).get("bild") as Blob;
      const id = `lokal_${Date.now().toString(36)}_${zaehler++}`;
      bilder.set(id, await base64(bild));
      return antwort({ fileId: id });
    }

    if (url === "/api/extract") {
      const daten = bilder.get(body.fileId);
      if (!daten) {
        return antwort({
          ok: false,
          fehler: "Bild nicht mehr im Speicher (Seite wurde neu geladen). Bitte neuen Auftrag beginnen und Dateien erneut auswählen.",
          wiederholbar: false,
        });
      }
      try {
        const msg = await client().beta.messages.create({
          ...baueAnfrage({ base64: daten }, MODEL, "low"),
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        });
        return antwort(antwortAuswerten(msg));
      } catch (err) {
        const r = fehler(err);
        const d = await r.json();
        return antwort({ ok: false, fehler: d.fehler, wiederholbar: r.status === 429 || r.status >= 500 }, r.status);
      }
    }

    if (url === "/api/cleanup") {
      for (const id of body.fileIds as string[]) bilder.delete(id);
      return antwort({ geloescht: body.fileIds.length, fehlgeschlagen: 0 });
    }

    return antwort({ fehler: "Unbekannte Anfrage " + url }, 404);
  } catch (err) {
    return fehler(err);
  }
}
