// Liest das Codebuch aus einer ExcelJS-Arbeitsmappe (läuft im Browser und in Node).
// Erwartet in der ersten Tabelle eine Kopfzeile mit u. a. ver26, Stadt, ort26, Raum, typ, titel, Filmtitel, datum.

function cellValue(v) {
  if (v == null) return null;
  if (typeof v === "object") {
    if (v instanceof Date) return v;
    if ("result" in v) return cellValue(v.result);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return v.text;
  }
  return v;
}

function toInt(v) {
  if (v == null || v === "") return null;
  const n = parseInt(String(v).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function toIsoDate(v) {
  if (v instanceof Date) {
    // Excel-Daten kommen als UTC-Mitternacht
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    const m = v.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (m) {
      const y = m[3].length === 2 ? "20" + m[3] : m[3];
      return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
  }
  return null;
}

/** @returns {Array<{ver:number, stadt:string, ort:number|null, raum:string, typ:number|null, titel:number|null, film:string, datum:string|null}>} */
export function parseCodebuchWorkbook(wb) {
  const ws = wb.worksheets[0];
  const header = {};
  ws.getRow(1).eachCell((cell, col) => {
    const name = String(cellValue(cell.value) ?? "").trim().toLowerCase();
    if (name && !(name in header)) header[name] = col;
  });
  const verKey = Object.keys(header).find((k) => /^ver\d*$/.test(k));
  const ortKey = Object.keys(header).find((k) => /^ort\d+$/.test(k));
  const need = ["stadt", "raum", "typ", "titel", "filmtitel", "datum"];
  const missing = need.filter((k) => !(k in header));
  if (!verKey) missing.unshift("ver26");
  if (!ortKey) missing.push("ort26");
  if (missing.length) {
    throw new Error("Im Codebuch fehlen Spalten: " + missing.join(", "));
  }
  const get = (row, key) => cellValue(row.getCell(header[key]).value);
  const events = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const ver = toInt(cellValue(row.getCell(header[verKey]).value));
    if (ver == null) continue;
    events.push({
      ver,
      stadt: String(get(row, "stadt") ?? "").trim(),
      ort: toInt(cellValue(row.getCell(header[ortKey]).value)),
      raum: String(get(row, "raum") ?? "").trim(),
      typ: toInt(get(row, "typ")),
      titel: toInt(get(row, "titel")),
      film: String(get(row, "filmtitel") ?? "").trim(),
      datum: toIsoDate(get(row, "datum")),
    });
  }
  return events;
}
