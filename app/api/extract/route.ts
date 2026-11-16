import { NextResponse } from "next/server";
import { antwortAuswerten, client, fehlerText, mockExtraktion, MOCK, seitenAnfrage } from "@/lib/claude";

export const maxDuration = 300;

// Wertet eine einzelne Seite sofort aus (für kleine Mengen und Tests).
export async function POST(req: Request) {
  const { fileId } = (await req.json()) as { fileId?: string };
  if (!fileId || !/^[\w-]{1,64}$/.test(fileId)) {
    return NextResponse.json({ fehler: "Ungültige Datei-ID." }, { status: 400 });
  }
  if (MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    return NextResponse.json({ ok: true, daten: mockExtraktion(fileId) });
  }
  try {
    // Bei einer Ablehnung durch die Sicherheitsfilter versucht die API es automatisch mit einem Ersatzmodell.
    const msg = await client.beta.messages.create({
      ...seitenAnfrage(fileId),
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    return NextResponse.json(antwortAuswerten(msg));
  } catch (err) {
    const { text, status } = fehlerText(err);
    return NextResponse.json({ ok: false, fehler: text, wiederholbar: status === 429 || status >= 500 }, { status });
  }
}
