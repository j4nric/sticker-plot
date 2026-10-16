// Konsistente Sicherung der SQLite-Datenbank im laufenden Betrieb.
// Aufruf: node scripts/backup.mjs [zielordner]
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const source = resolve(process.env.DATABASE_PATH ?? "./data/sticker-plot.db");
const targetDir = resolve(process.argv[2] ?? join(source, "..", "backups"));
mkdirSync(targetDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
const target = join(targetDir, `sticker-plot-${stamp}.db`);

const db = new Database(source, { readonly: true, fileMustExist: true });
await db.backup(target);
db.close();
console.log(`Sicherung geschrieben: ${target}`);
