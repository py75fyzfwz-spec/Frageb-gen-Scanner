// Macht aus Claudes Lesart eine Zeile im Format der Eingabetabelle.
import type { Extraktion } from "./fragebogen";
import { type Veranstaltung, zuordnen } from "./zuordnung";

export const SPALTEN = [
  "ID",
  "ver26",
  "ort26",
  "typ",
  "datum",
  "titel",
  "novize",
  "freq",
  "film",
  "talk",
  "veranst",
  "fest",
  "wieder",
  "nwieder",
  "age",
  "sex",
  "notiz",
] as const;
export type Spalte = (typeof SPALTEN)[number];

export type Zelle = string | number | Date | null;

export interface Zeile {
  werte: Record<Spalte, Zelle>;
  datei: string;
  seite: number;
  /** Spalten, die ein Mensch prüfen sollte */
  pruefen: Spalte[];
  hinweise: string[];
}

export interface Uebersprungen {
  datei: string;
  seite: number;
  grund: string;
}

const KOPF_SPALTEN: Spalte[] = ["ver26", "ort26", "typ", "datum", "titel"];

function zahl(s: string): number | null {
  const m = s.replace(/\s/g, "").match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function note(s: string): number | null {
  return s ? parseInt(s, 10) : null;
}

export function zeileBauen(
  e: Extraktion,
  quelle: { datei: string; seite: number },
  codebuch: Veranstaltung[],
  festeVeranstaltung: Veranstaltung | null,
): Zeile {
  const pruefen = new Set<Spalte>();
  const hinweise: string[] = [];
  if (e.hinweis) hinweise.push(e.hinweis);

  for (const f of e.unsicher) {
    if (f === "kopf") KOPF_SPALTEN.forEach((s) => pruefen.add(s));
    else pruefen.add(f);
  }

  // Veranstaltung
  let v = festeVeranstaltung;
  if (!v) {
    const z = zuordnen(e.kopf, codebuch);
    v = z.v;
    if (!z.sicher) {
      KOPF_SPALTEN.forEach((s) => pruefen.add(s));
      hinweise.push(z.grund + ` Gelesen: "${e.kopf.veranstaltungsort}", ${e.kopf.datum}, "${e.kopf.film}".`);
    }
  }

  // Erstbesuch und Häufigkeit (Konvention der Eingabetabelle: Ja -> novize 1, freq 1)
  let novize: number | null = e.novize === "ja" ? 1 : e.novize === "nein" ? 0 : null;
  let freq: number | null = zahl(e.freq);
  if (novize === 1) {
    if (freq != null && freq > 1) {
      pruefen.add("novize");
      pruefen.add("freq");
      hinweise.push(`"Ja" angekreuzt, aber Zahl ${freq} eingetragen.`);
    }
    freq = 1;
  } else if (novize === null && freq != null) {
    // Nur eine Zahl auf der Linie: wie bei der Handeingabe als "Nein" werten
    novize = 0;
  }
  if (novize === 0 && freq === 1) {
    // "bereits zum 1. Mal" ist widersprüchlich zu "Nein, nicht zum ersten Mal"
    pruefen.add("novize");
    pruefen.add("freq");
    hinweise.push('"Nein" (nicht zum ersten Mal), aber Zahl 1 eingetragen.');
  }
  if (freq != null && (freq < 1 || freq > 30)) pruefen.add("freq");

  const wieder = e.wieder === "ja" ? 1 : e.wieder === "nein" ? 0 : null;
  if (wieder === 1 && e.nwieder.trim()) pruefen.add("wieder");

  const age = zahl(e.age);
  if (age != null && (age < 3 || age > 105)) pruefen.add("age");
  if (e.age && age == null) pruefen.add("age");

  let sex: number | null = e.sex === "mann" ? 1 : e.sex === "frau" ? 2 : null;
  if (e.sex === "anderes") {
    pruefen.add("sex");
    hinweise.push("Geschlecht: weder m noch w angegeben.");
    sex = null;
  }

  const datum = v?.datum ? new Date(v.datum + "T00:00:00Z") : null;

  return {
    werte: {
      ID: null,
      ver26: v?.ver ?? null,
      ort26: v?.ort ?? null,
      typ: v?.typ ?? null,
      datum,
      titel: v?.titel ?? null,
      novize,
      freq,
      film: note(e.film),
      talk: note(e.talk),
      veranst: note(e.veranst),
      fest: note(e.fest),
      wieder,
      nwieder: e.nwieder.trim() || null,
      age,
      sex,
      notiz: e.notiz.trim() || null,
    },
    datei: quelle.datei,
    seite: quelle.seite,
    pruefen: SPALTEN.filter((s) => pruefen.has(s)),
    hinweise,
  };
}
