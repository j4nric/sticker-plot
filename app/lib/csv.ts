/** CSV lesen und schreiben (Excel-kompatibel: Semikolon, UTF-8 mit BOM, CRLF). */

/** Text, den Excel als Formel ausführen würde, beginnt mit einem dieser Zeichen. */
const FORMULA_START = /^[=+\-@\t\r]/;

/** Entfernt das beim Export vorangestellte Apostroph wieder. */
export function unescapeCsvText(s: string): string {
  return s.startsWith("'") && FORMULA_START.test(s.slice(1)) ? s.slice(1) : s;
}

export function toCsv(rows: (string | number | boolean | null | undefined)[][], sep = ";"): string {
  const cell = (v: string | number | boolean | null | undefined) => {
    let s = v == null ? "" : typeof v === "boolean" ? (v ? "ja" : "") : String(v);
    // Schutz vor Formel-Injektion in Excel/LibreOffice
    if (typeof v === "string" && FORMULA_START.test(s)) s = "'" + s;
    return /["\n\r;,]/.test(s) || s.startsWith(" ") || s.endsWith(" ") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(sep)).join("\r\n") + "\r\n";
}

/** Liest CSV mit Anführungszeichen und Zeilenumbrüchen in Feldern. Trennzeichen wird erkannt (; , Tab). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const counts = { ";": firstLine.split(";").length, ",": firstLine.split(",").length, "\t": firstLine.split("\t").length };
  const sep = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]![0]) as ";" | "," | "\t";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
