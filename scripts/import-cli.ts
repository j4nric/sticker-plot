/**
 * Kommandozeilen-Werkzeug: liest alte Etiketten-PDFs aus einem Ordner per
 * Texterkennung und trägt sie in die Datenbank ein.
 *
 *   node build/cli/import-pdfs.js <ordner-oder-dateien…> [--direkt] [--benutzer NAME]
 *
 * Ohne --direkt landen die Ergebnisse unter Verwaltung → Import zur Prüfung.
 * Mit --direkt werden neue Sorten sofort angelegt; vorhandene Namen werden
 * übersprungen, unsichere Erkennungen landen trotzdem zur Prüfung.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { acceptImport } from "~/lib/import/accept.server";
import { processItem } from "~/lib/import/queue.server";
import { stopOcr } from "~/lib/import/ocr.server";
import { addImportItem, getImportItem } from "~/models/import.server";
import { findTeaByName } from "~/models/tea.server";
import { audit } from "~/models/audit.server";
import type { ImportResult } from "~/lib/import/interpret";

function collect(paths: string[]): string[] {
  const out: string[] = [];
  for (const p of paths) {
    const full = resolve(p);
    const s = statSync(full, { throwIfNoEntry: false });
    if (!s) {
      console.error(`Nicht gefunden: ${p}`);
      continue;
    }
    if (s.isDirectory()) out.push(...collect(readdirSync(full).map((f) => join(full, f))));
    else if (full.toLowerCase().endsWith(".pdf")) out.push(full);
  }
  return out.sort();
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes("--hilfe") || args.includes("-h")) {
    console.log("Aufruf: node build/cli/import-pdfs.js <ordner-oder-dateien…> [--direkt] [--benutzer NAME]");
    process.exit(args.length ? 0 : 1);
  }
  const direct = args.includes("--direkt");
  const userIdx = args.indexOf("--benutzer");
  const user = userIdx >= 0 ? (args[userIdx + 1] ?? "import") : "import";
  const paths = args.filter((a, i) => !a.startsWith("--") && !(userIdx >= 0 && i === userIdx + 1));
  const files = collect(paths);
  if (!files.length) {
    console.error("Keine PDF-Dateien gefunden.");
    process.exit(1);
  }

  console.log(`${files.length} PDF-Dateien, Modus: ${direct ? "direkt anlegen" : "zur Prüfung in der Web-Oberfläche"}\n`);
  const stats = { created: 0, review: 0, duplicate: 0, error: 0 };
  for (const [i, file] of files.entries()) {
    const name = basename(file);
    const id = addImportItem(name, readFileSync(file), user);
    await processItem(id);
    const item = getImportItem(id)!;
    const prefix = `[${String(i + 1).padStart(String(files.length).length)}/${files.length}] ${name}`;
    if (item.status === "error") {
      stats.error++;
      console.log(`${prefix}: FEHLER ${item.error}`);
      continue;
    }
    const r = JSON.parse(item.result) as ImportResult;
    const summary = `${r.name || "?"} · ${r.teaType || "?"} · ${r.description.length} Zeichen Text`;
    if (direct && r.name && !r.warnings.length) {
      if (findTeaByName(r.name)) {
        stats.duplicate++;
        console.log(`${prefix}: übersprungen, „${r.name}“ gibt es schon (liegt zur Prüfung bereit)`);
        continue;
      }
      const ok = acceptImport(id, r);
      if (ok.ok) {
        stats.created++;
        console.log(`${prefix}: angelegt – ${summary}`);
        continue;
      }
    }
    stats.review++;
    console.log(`${prefix}: zur Prüfung – ${summary}${r.warnings.length ? ` (${r.warnings.join("; ")})` : ""}`);
  }
  audit(user, "import (kommandozeile)", "tee", null, `${stats.created} angelegt, ${stats.review} zur Prüfung, ${stats.duplicate} doppelt, ${stats.error} Fehler`);
  console.log(`\nFertig: ${stats.created} angelegt, ${stats.review} zur Prüfung, ${stats.duplicate} doppelt, ${stats.error} Fehler.`);
  if (stats.review || stats.duplicate) console.log("Prüfen unter: Verwaltung → Import");
  await stopOcr();
}

main().catch(async (e) => {
  console.error(e);
  await stopOcr();
  process.exit(1);
});
