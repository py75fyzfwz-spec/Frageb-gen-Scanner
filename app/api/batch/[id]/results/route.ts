import { NextResponse } from "next/server";
import { antwortAuswerten, client, type Ergebnis, fehlerText, MOCK } from "@/lib/claude";

export const maxDuration = 300;

// Ergebnisse eines fertigen Sammelauftrags, als { [fileId]: Ergebnis }.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ergebnisse: Record<string, Ergebnis> = {};
  if (MOCK) {
    // Testmodus: der Browser holt die erfundenen Ergebnisse dann einzeln über /api/extract.
    return NextResponse.json({ mock: true, ergebnisse });
  }
  try {
    for await (const r of await client.messages.batches.results(id)) {
      switch (r.result.type) {
        case "succeeded":
          ergebnisse[r.custom_id] = antwortAuswerten(r.result.message);
          break;
        case "errored":
          ergebnisse[r.custom_id] = {
            ok: false,
            fehler: "Fehler bei der Verarbeitung: " + (r.result.error?.error?.message ?? "unbekannt"),
            wiederholbar: true,
          };
          break;
        case "expired":
          ergebnisse[r.custom_id] = { ok: false, fehler: "Nicht rechtzeitig verarbeitet.", wiederholbar: true };
          break;
        case "canceled":
          ergebnisse[r.custom_id] = { ok: false, fehler: "Abgebrochen.", wiederholbar: true };
          break;
      }
    }
    return NextResponse.json({ ergebnisse });
  } catch (err) {
    const { text, status } = fehlerText(err);
    return NextResponse.json({ fehler: text }, { status });
  }
}
