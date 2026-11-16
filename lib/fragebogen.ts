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
   - Ist nur die Linie mit einer Zahl ausgefüllt (z. B. "3" oder "4 x"), aber kein Kästchen markiert, setze novize "nein". Das ist eindeutig genug und kommt nicht in "unsicher".
   - Steht statt einer Zahl ein Wort wie "viel", "oft" oder "X-ten", bleibt freq leer (nicht in "unsicher").
3. "Wie fanden Sie:" Tabelle mit den Zeilen Film (film), Publikumsgespräch (talk), Veranstaltung (veranst), Filmfestival (fest) und den Spalten Note 1 (sehr gut) bis Note 6 (sehr schlecht).
   Die Note ist die Spalte, deren Zahl angekreuzt, eingekreist, durchgestrichen oder sonst markiert ist. Achte auf die Spalte, nicht auf die Form der Markierung. Ein Kreuz, das die gedruckte Ziffer überdeckt, macht diese oft unleserlich: die Spalte zählt.
4. "Würden Sie noch einmal eine Veranstaltung des Filmfestivals besuchen?" Kästchen "Ja" oder "Nein, weil ___".
   - wieder: "ja" oder "nein". nwieder: der handschriftliche Grund nach "weil", sonst leer.
5. "Anmerkungen, Anregungen, Lob, Kritik:" freie Handschrift -> notiz. Gib den Text so wörtlich wie möglich wieder, mit normaler Rechtschreibung bei eindeutigen Wörtern, Zeilenumbrüche als Leerzeichen. Einzelne unleserliche Wörter als "[?]".
6. "Alter ___" -> age, nur die Zahl (z. B. "63"). Steht dort keine genaue Zahl (z. B. "18+", "über 60", "60-70"), bleibt age leer (nicht in "unsicher").
   "Geschlecht ___" -> sex: "w", "weiblich", "wbl.", "Frau", "f", "♀" = "frau"; "m", "männlich", "Mann", "♂" = "mann"; etwas anderes (z. B. "divers") = "anderes". Die Symbole ♀ und ♂ sind eindeutig und kommen nicht in "unsicher".

Regeln:
- Leere Felder bleiben leer (""), auch wenn andere Bögen dort etwas haben. Rate nie.
- Gib bei schwierigen Stellen immer deine beste Lesart an.
- Antworten, die nicht ins Format passen, lässt du einfach leer, ohne sie in "unsicher" einzutragen. Sie können ohnehin nicht ausgewertet werden. Beispiele: zwei oder mehr Noten in einer Zeile, Ja und Nein beide angekreuzt, "18+" statt einer Zahl, Wörter statt einer Zahl.
- Eine Note, die eindeutig in einer Spalte markiert ist, übernimmst du, auch wenn daneben eine Randnotiz steht.
- "unsicher" nur, wenn eine gültige Antwort dasteht, du sie aber nicht sicher lesen kannst und ein Mensch mit dem Papier wahrscheinlich anders entscheiden würde. Das sind z. B. eine Ziffer bei Alter oder Häufigkeit, die ernsthaft zwei Werte sein kann (61 oder 67), oder ein einzelnes Kreuz genau zwischen zwei Spalten.
- Nicht in "unsicher": wenn du dir bei deiner Lesart ziemlich sicher bist („vermutlich 82“ reicht nicht als Grund), eindeutig korrigierte Kreuze, ungewöhnliche Schreibweisen (Symbole, Abkürzungen), und der Wortlaut von notiz oder nwieder. Freitext muss nicht perfekt sein.
- Positiver Text auf der Linie "Nein, weil" bei angekreuztem Ja gehört in notiz, nicht in nwieder.
- Erfasse nur, was auf dieser Seite steht.
- Kritzeleien oder Zeichen am Rand (z. B. ein "?" neben einer Zeile ohne Kreuz, ein Kringel neben dem Datum) sind keine Antworten. Eine Zeile ohne Markierung bleibt leer.
- Gemalte Smileys im Anmerkungsfeld als ":-)" bzw. ":-(" wiedergeben.
- Bei den allermeisten Bögen bleibt "unsicher" leer.
- "hinweis": ein kurzer Satz auf Deutsch, warum Felder unsicher sind (z. B. "Film: Kreuz zwischen 1 und 2"). Leer, wenn "unsicher" leer ist.
- ist_fragebogen: false, wenn die Seite kein solcher Fragebogen ist (z. B. leere Rückseite, Deckblatt, anderes Dokument). Dann alle übrigen Felder leer lassen und im hinweis kurz beschreiben, was auf der Seite ist.`;

export const USER_PROMPT =
  "Lies diesen Fragebogen und gib die Antworten im vorgegebenen Format zurück.";
