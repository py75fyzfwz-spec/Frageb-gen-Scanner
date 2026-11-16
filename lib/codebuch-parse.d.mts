import type { Workbook } from "exceljs";
import type { Veranstaltung } from "./zuordnung";
export function parseCodebuchWorkbook(wb: Workbook): Veranstaltung[];
