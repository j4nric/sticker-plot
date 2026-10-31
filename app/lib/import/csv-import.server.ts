import { parseCsv, unescapeCsvText } from "~/lib/csv";
import { readTeaForm } from "~/lib/validation";
import { createTea, findTeaByName, updateTea } from "~/models/tea.server";
import { listTemplates } from "~/models/template.server";
import { guessTeaKind } from "~/label/tea-types";

export const CSV_COLUMNS = [
  "name",
  "titel",
  "teeart",
  "beschreibung",
  "zutaten",
  "motiv",
  "vorlage",
  "menge",
  "temperatur",
  "ziehzeit",
  "bio",
  "ean",
  "link",
  "preis",
  "haltbarkeit_monate",
  "archiviert",
] as const;

/** Spaltennamen, die zusätzlich verstanden werden. */
const ALIASES: Record<string, (typeof CSV_COLUMNS)[number]> = {
  title: "titel",
  sorte: "name",
  teesorte: "name",
  art: "teeart",
  tea_type: "teeart",
  typ: "teeart",
  description: "beschreibung",
  text: "beschreibung",
  ingredients: "zutaten",
  menge_pro_tasse: "menge",
  temp: "temperatur",
  "temperatur_c": "temperatur",
  zeit: "ziehzeit",
  organic: "bio",
  url: "link",
  qr: "link",
  price: "preis",
  haltbarkeit: "haltbarkeit_monate",
};

const yes = (v: string) => /^(ja|yes|true|1|x|wahr)$/i.test(v.trim());

export interface CsvImportReport {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; name: string; message: string }[];
}

export function importTeasFromCsv(text: string, mode: "create" | "upsert"): CsvImportReport {
  const rows = parseCsv(text);
  const report: CsvImportReport = { created: 0, updated: 0, skipped: 0, errors: [] };
  if (rows.length < 2) {
    report.errors.push({ row: 1, name: "", message: "Die Datei enthält keine Datenzeilen." });
    return report;
  }
  const header = rows[0]!.map((h) => {
    const k = h.trim().toLowerCase().replace(/\s+/g, "_");
    return (CSV_COLUMNS as readonly string[]).includes(k) ? k : (ALIASES[k] ?? k);
  });
  if (!header.includes("name")) {
    report.errors.push({ row: 1, name: "", message: "Spalte „name“ fehlt in der ersten Zeile." });
    return report;
  }
  const templates = new Map(listTemplates().map((t) => [t.name.toLowerCase(), t.id]));

  rows.slice(1).forEach((cells, i) => {
    const rowNo = i + 2;
    const get = (k: string) => {
      const idx = header.indexOf(k);
      return idx >= 0 ? unescapeCsvText((cells[idx] ?? "").trim()) : "";
    };
    const name = get("name");
    if (!name) {
      report.skipped++;
      return;
    }
    const existing = findTeaByName(name);
    if (existing && mode === "create") {
      report.skipped++;
      return;
    }
    const form = new FormData();
    // Teeart als Text, z. B. „Aromatisierter Schwarztee“ oder „Grüner Tee“
    const kind = guessTeaKind(get("teeart")) ?? (existing ? guessTeaKind(existing.teaType) : null);
    const entries: Record<string, string> = {
      name,
      title: get("titel") || existing?.title || "",
      kind: kind?.kind ?? "",
      description: get("beschreibung"),
      ingredients: get("zutaten"),
      motif: get("motiv") || "auto",
      templateId: String(templates.get(get("vorlage").toLowerCase()) ?? ""),
      brewAmount: get("menge"),
      brewTemp: get("temperatur").replace(/\s*°?\s*c$/i, ""),
      brewTime: get("ziehzeit"),
      ean: get("ean"),
      productUrl: get("link"),
      price: get("preis"),
      shelfLifeMonths: get("haltbarkeit_monate"),
    };
    for (const [k, v] of Object.entries(entries)) form.set(k, v);
    if (yes(get("bio"))) form.set("organic", "on");
    if (kind?.flavored || yes(get("aromatisiert"))) form.set("flavored", "on");
    const parsed = readTeaForm(form);
    if (!parsed.ok) {
      const message = parsed.errors.kind && !kind ? `Teeart „${get("teeart")}“ nicht erkannt (Früchtetee, Kräutertee, Schwarztee, Grüntee oder Rooibostee).` : Object.values(parsed.errors).join(" ");
      report.errors.push({ row: rowNo, name, message });
      return;
    }
    if (existing) {
      updateTea(existing.id, parsed.value);
      report.updated++;
    } else {
      createTea(parsed.value);
      report.created++;
    }
  });
  return report;
}
