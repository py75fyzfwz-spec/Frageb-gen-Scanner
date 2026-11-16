import type { Extraktion } from "./fragebogen";

/** Ergebnis für eine Seite, wie es die API-Routen an den Browser schicken. */
export type Ergebnis =
  | { ok: true; daten: Extraktion }
  | { ok: false; fehler: string; wiederholbar: boolean };
