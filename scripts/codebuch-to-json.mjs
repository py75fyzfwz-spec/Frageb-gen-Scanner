// Wandelt ein Codebuch (xlsx) in data/codebuch.json um.
// Aufruf: npm run codebuch -- pfad/zum/codebuch.xlsx
import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";
import { parseCodebuchWorkbook } from "../lib/codebuch-parse.mjs";

const file = process.argv[2];
if (!file) {
  console.error("Bitte Pfad zur Codebuch-Datei angeben.");
  process.exit(1);
}
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const events = parseCodebuchWorkbook(wb);
writeFileSync("data/codebuch.json", JSON.stringify(events, null, 1));
console.log(`${events.length} Veranstaltungen nach data/codebuch.json geschrieben.`);
