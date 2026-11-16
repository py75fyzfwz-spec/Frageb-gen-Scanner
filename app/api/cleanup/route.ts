import { NextResponse } from "next/server";
import { client, MOCK } from "@/lib/claude";

export const maxDuration = 300;

// Löscht hochgeladene Seitenbilder bei Anthropic (Datenschutz). Bis zu 200 pro Aufruf.
export async function POST(req: Request) {
  const { fileIds } = (await req.json()) as { fileIds?: string[] };
  if (!Array.isArray(fileIds) || fileIds.length > 200) {
    return NextResponse.json({ fehler: "Ungültige Liste." }, { status: 400 });
  }
  if (MOCK) return NextResponse.json({ geloescht: fileIds.length, fehlgeschlagen: 0 });
  let geloescht = 0;
  let fehlgeschlagen = 0;
  for (let i = 0; i < fileIds.length; i += 10) {
    const res = await Promise.allSettled(fileIds.slice(i, i + 10).map((id) => client.files.delete(id)));
    for (const r of res) {
      if (r.status === "fulfilled") geloescht++;
      else if (r.reason instanceof Error && "status" in r.reason && r.reason.status === 404) geloescht++;
      else fehlgeschlagen++;
    }
  }
  return NextResponse.json({ geloescht, fehlgeschlagen });
}
