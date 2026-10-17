import Database from "better-sqlite3";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { closeDb, db, sqlite } from "~/db/db.server";
import { env } from "./env.server";

export function backupDir(): string {
  return join(dirname(resolve(env.databasePath)), "backups");
}

const stamp = () => new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);

/** Konsistente Kopie im laufenden Betrieb (SQLite-Backup-API). */
export async function createBackup(label = "manuell"): Promise<string> {
  const dir = backupDir();
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `sticker-plot-${stamp()}-${label}.db`);
  await sqlite().backup(file);
  return file;
}

export function listBackups() {
  const dir = backupDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^[\w.-]+\.db$/.test(f))
    .map((f) => {
      const s = statSync(join(dir, f));
      return { name: f, size: s.size, modified: s.mtime };
    })
    .sort((a, b) => b.modified.valueOf() - a.modified.valueOf());
}

/** Pfad einer Sicherung, nur einfache Dateinamen aus dem Sicherungsordner. */
export function backupPath(name: string): string | null {
  if (basename(name) !== name || !/^[\w.-]+\.db$/.test(name)) return null;
  const p = join(backupDir(), name);
  return existsSync(p) ? p : null;
}

/** Prüft, ob eine Datei eine Datenbank dieser App ist. */
export function inspectDatabase(path: string): { ok: true; teas: number; users: number } | { ok: false; error: string } {
  let conn: Database.Database | undefined;
  try {
    conn = new Database(path, { readonly: true, fileMustExist: true });
    const integrity = conn.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") return { ok: false, error: "Die Datei ist beschädigt." };
    const tables = new Set((conn.prepare("select name from sqlite_master where type='table'").all() as { name: string }[]).map((t) => t.name));
    if (!tables.has("teas") || !tables.has("printers")) return { ok: false, error: "Die Datei ist keine Sicherung dieser App." };
    const teas = (conn.prepare("select count(*) n from teas").get() as { n: number }).n;
    const users = tables.has("users") ? (conn.prepare("select count(*) n from users").get() as { n: number }).n : 0;
    return { ok: true, teas, users };
  } catch {
    return { ok: false, error: "Die Datei ist keine SQLite-Datenbank." };
  } finally {
    conn?.close();
  }
}

/**
 * Ersetzt die aktuelle Datenbank durch eine Sicherung. Vorher wird der
 * aktuelle Stand automatisch gesichert.
 */
export async function restoreDatabase(data: Buffer): Promise<{ ok: true; safety: string; teas: number } | { ok: false; error: string }> {
  const target = resolve(env.databasePath);
  const tmp = join(backupDir(), `upload-${stamp()}.tmp`);
  mkdirSync(backupDir(), { recursive: true });
  writeFileSync(tmp, data);
  try {
    const info = inspectDatabase(tmp);
    if (!info.ok) return info;
    const safety = await createBackup("vor-wiederherstellung");
    closeDb();
    copyFileSync(tmp, target);
    for (const suffix of ["-wal", "-shm"]) rmSync(target + suffix, { force: true });
    db(); // öffnet neu und führt fehlende Migrationen aus
    return { ok: true, safety: basename(safety), teas: info.teas };
  } finally {
    rmSync(tmp, { force: true });
  }
}
