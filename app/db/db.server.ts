import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { env } from "~/lib/env.server";
import { hashPassword } from "~/lib/password.server";
import { DEFAULT_SHEET } from "~/label/geometry";
import { guessTeaKind, teaTypeLabel } from "~/label/tea-types";
import { DEFAULT_TEMPLATE_PARAMS } from "~/label/template";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as { __teaDb?: Db; __teaSqlite?: Database.Database };

/** Grunddaten, die immer vorhanden sein müssen. Läuft bei jedem Start und ergänzt nur Fehlendes. */
function seed(db: Db) {
  const one = <T>(rows: T[]) => rows[0];
  if (!one(db.select({ id: schema.printers.id }).from(schema.printers).limit(1).all())) {
    db.insert(schema.printers).values({ name: "Laden-Drucker", isDefault: true }).run();
  }
  if (!one(db.select({ id: schema.sheetFormats.id }).from(schema.sheetFormats).limit(1).all())) {
    db.insert(schema.sheetFormats).values({ name: "A4 quer, 6 × 2 (Standard)", ...DEFAULT_SHEET, isDefault: true }).run();
  }
  if (!one(db.select({ id: schema.templates.id }).from(schema.templates).limit(1).all())) {
    db.insert(schema.templates).values({ name: "Standard", params: JSON.stringify(DEFAULT_TEMPLATE_PARAMS), isDefault: true }).run();
  }
  if (!one(db.select({ id: schema.users.id }).from(schema.users).limit(1).all())) {
    // Erster Zugang: Benutzer „admin“ mit dem Passwort aus APP_PASSWORD
    db.insert(schema.users)
      .values({ username: "admin", displayName: "Administrator", role: "admin", passwordHash: hashPassword(env.appPassword) })
      .run();
  }
  const defaults: Record<string, unknown> = {
    shop: { name: env.shop.name, url: env.shop.url, address: "", organicCode: "" },
    overflowPolicy: "block",
  };
  for (const [key, value] of Object.entries(defaults)) {
    db.insert(schema.settings).values({ key, value: JSON.stringify(value) }).onConflictDoNothing().run();
  }
}

/**
 * Alte Sorten mit freier Teeart einer der fünf Arten zuordnen
 * („Grüner Tee“ → Grüntee). Nicht erkennbare bleiben leer und werden im
 * Editor zur Auswahl angeboten.
 */
function assignTeaKinds(sqlite: Database.Database) {
  const rows = sqlite.prepare("SELECT id, tea_type FROM teas WHERE kind = ''").all() as { id: number; tea_type: string }[];
  const update = sqlite.prepare("UPDATE teas SET kind = ?, flavored = ?, tea_type = ? WHERE id = ?");
  for (const r of rows) {
    const guess = guessTeaKind(r.tea_type);
    if (guess) update.run(guess.kind, guess.flavored ? 1 : 0, teaTypeLabel(guess.kind, guess.flavored), r.id);
  }
}

export function openDb(path: string): { db: Db; sqlite: Database.Database } {
  if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });
  seed(db);
  assignTeaKinds(sqlite);
  return { db, sqlite };
}

/** Eine Verbindung pro Prozess, überlebt Hot-Reloads in der Entwicklung. */
export function db(): Db {
  if (!globalForDb.__teaDb) {
    const opened = openDb(env.databasePath);
    globalForDb.__teaDb = opened.db;
    globalForDb.__teaSqlite = opened.sqlite;
  }
  return globalForDb.__teaDb;
}

export function sqlite(): Database.Database {
  db();
  return globalForDb.__teaSqlite!;
}

/** Schließt die Verbindung (z. B. vor dem Wiederherstellen einer Sicherung). */
export function closeDb() {
  globalForDb.__teaSqlite?.close();
  globalForDb.__teaDb = undefined;
  globalForDb.__teaSqlite = undefined;
}
