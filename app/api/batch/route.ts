import { NextResponse } from "next/server";
import { client, fehlerText, MOCK, seitenAnfrage } from "@/lib/claude";

export const maxDuration = 120;

// Legt einen Sammelauftrag (Message Batch) an: halber Preis, Ergebnis meist innerhalb einer Stunde.
export async function POST(req: Request) {
  const { fileIds } = (await req.json()) as { fileIds?: string[] };
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    return NextResponse.json({ fehler: "Keine Seiten übergeben." }, { status: 400 });
  }
  if (fileIds.length > 100_000 || fileIds.some((id) => !/^[\w-]{1,64}$/.test(id))) {
    return NextResponse.json({ fehler: "Ungültige Seitenliste." }, { status: 400 });
  }
  if (new Set(fileIds).size !== fileIds.length) {
    return NextResponse.json({ fehler: "Seiten doppelt in der Liste." }, { status: 400 });
  }
  if (MOCK) return NextResponse.json({ batchId: "msgbatch_mock_" + fileIds.length + "_" + Date.now() });
  try {
    const batch = await client.messages.batches.create({
      requests: fileIds.map((id) => ({ custom_id: id, params: seitenAnfrage(id) })),
    });
    return NextResponse.json({ batchId: batch.id });
  } catch (err) {
    const { text, status } = fehlerText(err);
    return NextResponse.json({ fehler: text }, { status });
  }
}
