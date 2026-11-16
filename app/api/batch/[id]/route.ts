import { NextResponse } from "next/server";
import { client, fehlerText, MOCK } from "@/lib/claude";

// Stand eines Sammelauftrags abfragen.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (MOCK) {
    const [, , n, t] = id.split("_");
    const fertig = Date.now() - Number(t) > 15_000;
    return NextResponse.json({
      status: fertig ? "ended" : "in_progress",
      zaehler: { processing: fertig ? 0 : Number(n), succeeded: fertig ? Number(n) : 0, errored: 0, canceled: 0, expired: 0 },
    });
  }
  try {
    const b = await client.messages.batches.retrieve(id);
    return NextResponse.json({ status: b.processing_status, zaehler: b.request_counts, endetBis: b.expires_at });
  } catch (err) {
    const { text, status } = fehlerText(err);
    return NextResponse.json({ fehler: text }, { status });
  }
}
