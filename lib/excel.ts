// Baut die Excel-Datei im Browser.
import ExcelJS from "exceljs";
import { SPALTEN, type Uebersprungen, type Zeile } from "./zeilen";

const GELB: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2A8" } };
const GRAU: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } };

export async function excelBauen(zeilen: Zeile[], uebersprungen: Uebersprungen[], startId: number | null): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Fragebogen-App";
  wb.created = new Date();

  // Blatt 1: genau die Spalten der Eingabetabelle, dahinter Hilfsspalten
  const ws = wb.addWorksheet("Tabelle1", { views: [{ state: "frozen", ySplit: 1 }] });
  const kopf = [...SPALTEN, "Datei", "Seite", "Prüfen", "Hinweis"];
  ws.addRow(kopf);
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).eachCell((c, col) => {
    if (col > SPALTEN.length) c.fill = GRAU;
  });

  zeilen.forEach((z, i) => {
    const id = startId != null ? String(startId + i) : null;
    z.werte.ID = id;
    const row = ws.addRow([
      ...SPALTEN.map((s) => z.werte[s]),
      z.datei,
      z.seite,
      z.pruefen.length ? z.pruefen.join(", ") : null,
      z.hinweise.join(" ") || null,
    ]);
    for (const s of z.pruefen) row.getCell(SPALTEN.indexOf(s) + 1).fill = GELB;
    if (z.pruefen.length) row.getCell(SPALTEN.length + 3).fill = GELB;
  });

  ws.getColumn(SPALTEN.indexOf("datum") + 1).numFmt = "dd.mm.yyyy";
  ws.columns.forEach((col, i) => {
    const name = kopf[i];
    col.width = name === "notiz" || name === "Hinweis" ? 50 : name === "nwieder" || name === "Datei" ? 25 : name === "datum" ? 12 : 9;
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: kopf.length } };

  // Blatt 2: Liste zum Nachprüfen
  const wp = wb.addWorksheet("Zu prüfen", { views: [{ state: "frozen", ySplit: 1 }] });
  wp.addRow(["ID", "Zeile in Tabelle1", "Datei", "Seite", "Spalten prüfen", "Hinweis"]);
  wp.getRow(1).font = { bold: true };
  zeilen.forEach((z, i) => {
    if (z.pruefen.length) wp.addRow([z.werte.ID, i + 2, z.datei, z.seite, z.pruefen.join(", "), z.hinweise.join(" ")]);
  });
  wp.columns = [{ width: 8 }, { width: 10 }, { width: 30 }, { width: 7 }, { width: 25 }, { width: 80 }];

  // Blatt 3: Seiten ohne Ergebnis
  const wu = wb.addWorksheet("Nicht ausgewertet");
  wu.addRow(["Datei", "Seite", "Grund"]);
  wu.getRow(1).font = { bold: true };
  for (const u of uebersprungen) wu.addRow([u.datei, u.seite, u.grund]);
  wu.columns = [{ width: 30 }, { width: 7 }, { width: 80 }];

  // Blatt 4: Erklärung
  const wi = wb.addWorksheet("Info");
  const pruefAnzahl = zeilen.filter((z) => z.pruefen.length).length;
  [
    ["Erstellt", new Date().toLocaleString("de-DE")],
    ["Ausgewertete Bögen", zeilen.length],
    ["Davon zu prüfen", pruefAnzahl],
    ["Nicht ausgewertete Seiten", uebersprungen.length],
    [],
    ["Gelbe Zellen", "Hier war die Lesart unsicher. Bitte mit dem Papierbogen vergleichen (Datei und Seite stehen rechts)."],
    ["Spalten A bis Q", "Entsprechen der Eingabetabelle und können dort direkt eingefügt werden."],
    ["Kodierung", "novize: 1 = Ja, 0 = Nein; freq: 1 bei Erstbesuch; Noten 1 (sehr gut) bis 6; wieder: 1 = Ja, 0 = Nein; sex: 1 = Mann, 2 = Frau."],
    ["Veranstaltung", "ver26, ort26, typ, datum und titel stammen aus dem Codebuch, zugeordnet über Ort, Datum und Film auf dem Bogen."],
  ].forEach((r) => wi.addRow(r));
  wi.getColumn(1).width = 26;
  wi.getColumn(2).width = 100;
  wi.getColumn(1).font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
