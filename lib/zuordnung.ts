// Ordnet den gedruckten Kopf eines Bogens (Ort, Datum, Film) einer Veranstaltung aus dem Codebuch zu.

export interface Veranstaltung {
  ver: number;
  stadt: string;
  ort: number | null;
  raum: string;
  typ: number | null;
  titel: number | null;
  film: string;
  datum: string | null; // JJJJ-MM-TT
}

export interface Zuordnung {
  v: Veranstaltung | null;
  sicher: boolean;
  grund: string;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function trigramme(s: string): Set<string> {
  const t = ` ${norm(s)} `;
  const out = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
}

/** Ähnlichkeit 0..1 (Dice über Buchstaben-Dreier). Teilstring zählt als sehr ähnlich. */
export function aehnlich(a: string, b: string): number {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) return 0.9;
  const A = trigramme(a);
  const B = trigramme(b);
  let gemeinsam = 0;
  for (const x of A) if (B.has(x)) gemeinsam++;
  return (2 * gemeinsam) / (A.size + B.size);
}

/** "04.11.2026", "4.11.26" -> "2026-11-04" */
export function datumIso(s: string): string | null {
  const m = s.match(/(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{2,4})/);
  if (!m) return null;
  const y = m[3].length === 2 ? "20" + m[3] : m[3];
  return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export function zuordnen(
  kopf: { veranstaltungsort: string; datum: string; film: string },
  codebuch: Veranstaltung[],
): Zuordnung {
  const datum = datumIso(kopf.datum);
  const bewertet = codebuch
    .map((v) => {
      const ort = Math.max(aehnlich(kopf.veranstaltungsort, v.raum), aehnlich(kopf.veranstaltungsort, `${v.raum} ${v.stadt}`));
      const film = aehnlich(kopf.film, v.film);
      const tag = datum && v.datum === datum ? 1 : 0;
      return { v, ort, film, tag, punkte: 3 * tag + 2 * film + 2 * ort };
    })
    .sort((a, b) => b.punkte - a.punkte);

  const best = bewertet[0];
  const zweit = bewertet[1];
  if (!best || best.punkte < 2.5) {
    return { v: null, sicher: false, grund: "Keine passende Veranstaltung im Codebuch gefunden." };
  }
  const abstand = best.punkte - (zweit?.punkte ?? 0);
  const sicher = best.tag === 1 && best.film >= 0.6 && best.ort >= 0.5 && abstand >= 0.4;
  let grund = "";
  if (!sicher) {
    const teile: string[] = [];
    if (!best.tag) teile.push("Datum passt nicht");
    if (best.film < 0.6) teile.push("Film passt nur ungefähr");
    if (best.ort < 0.5) teile.push("Ort passt nur ungefähr");
    if (abstand < 0.4) teile.push(`auch möglich: Veranstaltung ${zweit.v.ver}`);
    grund = `Veranstaltung ${best.v.ver} geraten (${teile.join(", ")}).`;
  }
  return { v: best.v, sicher, grund };
}

export function veranstaltungText(v: Veranstaltung): string {
  const d = v.datum ? v.datum.split("-").reverse().join(".") : "ohne Datum";
  return `${v.ver}: ${v.stadt}, ${v.raum}, ${d}, ${v.film}`;
}
