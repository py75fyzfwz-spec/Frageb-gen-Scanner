import { NextResponse } from "next/server";
import { toFile } from "@anthropic-ai/sdk";
import { client, FILE_TTL_SECONDS, fehlerText, MOCK } from "@/lib/claude";

export const maxDuration = 60;

// Nimmt ein Seitenbild (JPEG) entgegen und legt es bei Anthropic ab.
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("bild");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ fehler: "Kein Bild empfangen." }, { status: 400 });
  }
  if (file.size > 4_000_000) {
    return NextResponse.json({ fehler: "Bild ist zu groß (max. 4 MB)." }, { status: 413 });
  }
  const name = String(form.get("name") || "seite.jpg").replace(/[^\w.\-]+/g, "_");
  if (MOCK) {
    return NextResponse.json({ fileId: "file_mock" + Math.random().toString(36).slice(2, 14) });
  }
  try {
    const meta = await client.files.upload({
      file: await toFile(file, name, { type: file.type || "image/jpeg" }),
      expires_in_seconds: FILE_TTL_SECONDS,
    });
    return NextResponse.json({ fileId: meta.id });
  } catch (err) {
    const { text, status } = fehlerText(err);
    return NextResponse.json({ fehler: text }, { status });
  }
}
