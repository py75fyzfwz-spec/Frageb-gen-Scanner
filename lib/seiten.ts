// Zerlegt die ausgewählten Dateien im Browser in einzelne Seitenbilder (JPEG).

const MAX_KANTE = 1800; // Pixel an der langen Seite; Scans mit 150 dpi haben ca. 1750
const QUALITAET = 0.85;

export interface SeitenQuelle {
  key: string;
  datei: string;
  seite: number;
  bild: () => Promise<Blob>;
}

function canvasZuJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Bild konnte nicht erzeugt werden."))), "image/jpeg", QUALITAET),
  );
}

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
function pdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      return m;
    });
  }
  return pdfjsPromise;
}

// Offene PDF-Dokumente: höchstens zwei gleichzeitig, damit bei Tausenden Seiten der Speicher reicht.
type PdfDoc = Awaited<ReturnType<Awaited<ReturnType<typeof pdfjs>>["getDocument"]>["promise"]>;
const offen: Array<{ f: File; doc: Promise<PdfDoc> }> = [];
function pdfOeffnen(f: File): Promise<PdfDoc> {
  const da = offen.find((o) => o.f === f);
  if (da) return da.doc;
  const doc = pdfjs().then(async (lib) => lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise);
  offen.push({ f, doc });
  if (offen.length > 2) {
    const alt = offen.shift()!;
    // etwas warten, falls noch eine Seite daraus gerendert wird
    setTimeout(() => alt.doc.then((d) => d.destroy()).catch(() => {}), 60_000);
  }
  return doc;
}

/** Liefert für jede Seite jeder Datei einen Eintrag; das Bild wird erst bei Bedarf erzeugt. */
export async function seitenAuflisten(dateien: File[]): Promise<SeitenQuelle[]> {
  const out: SeitenQuelle[] = [];
  for (const f of dateien) {
    const istPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (istPdf) {
      const doc = await pdfOeffnen(f);
      for (let n = 1; n <= doc.numPages; n++) {
        out.push({
          key: `${f.name}|${f.size}|${n}`,
          datei: f.name,
          seite: n,
          bild: async () => {
            const page = await (await pdfOeffnen(f)).getPage(n);
            const basis = page.getViewport({ scale: 1 });
            const scale = MAX_KANTE / Math.max(basis.width, basis.height);
            const vp = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(vp.width);
            canvas.height = Math.round(vp.height);
            const ctx = canvas.getContext("2d")!;
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
            page.cleanup();
            return canvasZuJpeg(canvas);
          },
        });
      }
    } else if (f.type.startsWith("image/")) {
      out.push({
        key: `${f.name}|${f.size}|1`,
        datei: f.name,
        seite: 1,
        bild: async () => {
          const bmp = await createImageBitmap(f);
          const scale = Math.min(1, MAX_KANTE / Math.max(bmp.width, bmp.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(bmp.width * scale);
          canvas.height = Math.round(bmp.height * scale);
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
          bmp.close();
          return canvasZuJpeg(canvas);
        },
      });
    } else {
      throw new Error(`"${f.name}" ist weder PDF noch Bild (JPG/PNG).`);
    }
  }
  return out;
}
