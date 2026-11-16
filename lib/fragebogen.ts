// Beschreibung des Fragebogens: Was Claude lesen soll und in welcher Form.
// Wenn sich der Fragebogen ändert, ist das die Datei, die angepasst wird.

export const FELDER = [
  "kopf",
  "novize",
  "freq",
  "film",
  "talk",
  "veranst",
  "fest",
  "wieder",
  "nwieder",
  "notiz",
  "age",
  "sex",
] as const;
export type Feld = (typeof FELDER)[number];

export type Note = "1" | "2" | "3" | "4" | "5" | "6" | "";

/** So liefert Claude eine Seite zurück. */
export interface Extraktion {
  ist_fragebogen: boolean;
  kopf: { veranstaltungsort: string; datum: string; film: string };
  novize: "ja" | "nein" | "";
  freq: string;
  film: Note;
  talk: Note;
  veranst: Note;
  fest: Note;
  wieder: "ja" | "nein" | "";
  nwieder: string;
  notiz: string;
  age: string;
  sex: "mann" | "frau" | "anderes" | "";
  unsicher: Feld[];
  hinweis: string;
}

const NOTE = { type: "string", enum: ["1", "2", "3", "4", "5", "6", ""] };

/** JSON-Schema für Structured Outputs: Claude muss genau diese Form liefern. */
export const EXTRAKTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "ist_fragebogen",
    "kopf",
    "novize",
    "freq",
    "film",
    "talk",
    "veranst",
    "fest",
    "wieder",
    "nwieder",
    "notiz",
    "age",
    "sex",
    "unsicher",
    "hinweis",
  ],
  properties: {
    ist_fragebogen: { type: "boolean" },
    kopf: {
      type: "object",
      additionalProperties: false,
      required: ["veranstaltungsort", "datum", "film"],
      properties: {
        veranstaltungsort: { type: "string" },
        datum: { type: "string" },
        film: { type: "string" },
      },
    },
    novize: { type: "string", enum: ["ja", "nein", ""] },
    freq: { type: "string" },
    film: NOTE,
    talk: NOTE,
    veranst: NOTE,
    fest: NOTE,
    wieder: { type: "string", enum: ["ja", "nein", ""] },
    nwieder: { type: "string" },
    notiz: { type: "string" },
    age: { type: "string" },
    sex: { type: "string", enum: ["mann", "frau", "anderes", ""] },
    unsicher: { type: "array", items: { type: "string", enum: [...FELDER] } },
    hinweis: { type: "string" },
  },
} as const;

export const SYSTEM_PROMPT = `Du liest eingescannte, von Hand ausgefüllte Papier-Fragebögen des "Europäischen Filmfestivals der Generationen" und überträgst die Antworten in eine feste Datenstruktur. Die Daten fließen in eine wissenschaftliche Auswertung, deshalb gilt: genau ablesen, nichts erfinden, Zweifel kennzeichnen.

Aufbau eines Bogens (eine A4-Seite):
1. Gedruckter Kopf: "Veranstaltungsort: …", "Datum: …", "Besuchter Film: …". Diese Angaben sind vorgedruckt. Übernimm sie wörtlich in "kopf" (Datum so, wie es dasteht, z. B. "04.11.2026").
2. "Nehmen Sie zum ersten Mal als Besucher am Filmfestival der Generationen teil?"
   Kästchen "Ja" oder "Nein, ich nehme bereits zum ___ teil (in Jahren)."
   - novize: "ja", wenn Ja markiert ist; "nein", wenn Nein markiert ist.
   - freq: die Zahl, die auf der Linie steht (nur Ziffern, z. B. "3"). Steht dort ein Wort wie "dritten Mal" oder "3." , schreibe die Zahl ("3"). Leer lassen, wenn nichts dasteht.
   - Ist nur die Linie ausgefüllt, aber kein Kästchen markiert, setze novize "nein" und trage "novize" in unsicher ein.
3. "Wie fanden Sie:" Tabelle mit den Zeilen Film (film), Publikumsgespräch (talk), Veranstaltung (veranst), Filmfestival (fest) und den Spalten Note 1 (sehr gut) bis Note 6 (sehr schlecht).
   Die Note ist die Spalte, deren Zahl angekreuzt, eingekreist, durchgestrichen oder sonst markiert ist. Achte auf die Spalte, nicht auf die Form der Markierung. Ein Kreuz, das die gedruckte Ziffer überdeckt, macht diese oft unleserlich: die Spalte zählt.
4. "Würden Sie noch einmal eine Veranstaltung des Filmfestivals besuchen?" Kästchen "Ja" oder "Nein, weil ___".
   - wieder: "ja" oder "nein". nwieder: der handschriftliche Grund nach "weil", sonst leer.
5. "Anmerkungen, Anregungen, Lob, Kritik:" freie Handschrift -> notiz. Gib den Text so wörtlich wie möglich wieder, mit normaler Rechtschreibung bei eindeutigen Wörtern, Zeilenumbrüche als Leerzeichen. Einzelne unleserliche Wörter als "[?]".
6. "Alter ___" -> age, nur die Zahl (z. B. "63"). "Geschlecht ___" -> sex: "w", "weiblich", "Frau", "f" = "frau"; "m", "männlich", "Mann" = "mann"; etwas anderes (z. B. "divers") = "anderes".

Regeln:
- Leere Felder bleiben leer (""), auch wenn andere Bögen dort etwas haben. Rate nie.
- Mehrere Markierungen in einer Zeile, Markierung genau zwischen zwei Spalten, durchgestrichene und neu gesetzte Kreuze, schwer lesbare Ziffern oder Wörter: gib deine beste Lesart an und trage das Feld in "unsicher" ein. Wenn es keine sinnvolle beste Lesart gibt, lass das Feld leer und trage es trotzdem in "unsicher" ein.
- Eine Markierung, die eindeutig korrigiert wurde (z. B. ein Kreuz durchgestrichen und ein anderes deutlich gesetzt, oder ein Hinweis wie "falsch"), zählt in ihrer korrigierten Form; trage das Feld dann in "unsicher" ein.
- Erfasse nur, was auf dieser Seite steht.
- Kritzeleien oder Zeichen am Rand (z. B. ein "?" neben einer Zeile ohne Kreuz, ein Kringel neben dem Datum) sind keine Antworten. Eine Zeile ohne Markierung bleibt leer.
- Gemalte Smileys im Anmerkungsfeld als ":-)" bzw. ":-(" wiedergeben.
- "unsicher" enthält nur Felder, bei denen ein Mensch nachschauen sollte. Bei klaren Antworten bleibt die Liste leer.
- "hinweis": ein kurzer Satz auf Deutsch, warum Felder unsicher sind (z. B. "Film: Kreuz zwischen 1 und 2"). Leer, wenn alles klar ist.
- ist_fragebogen: false, wenn die Seite kein solcher Fragebogen ist (z. B. leere Rückseite, Deckblatt, anderes Dokument). Dann alle übrigen Felder leer lassen und im hinweis kurz beschreiben, was auf der Seite ist.`;

export const USER_PROMPT =
  "Lies diesen Fragebogen und gib die Antworten im vorgegebenen Format zurück.";
