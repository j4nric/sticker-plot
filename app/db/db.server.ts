import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { env } from "~/lib/env.server";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as { __teaDb?: Db };

export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });
  // Ein Standarddrucker muss immer existieren, damit sofort gedruckt werden kann.
  const anyPrinter = db.select({ id: schema.printers.id }).from(schema.printers).limit(1).get();
  if (!anyPrinter) {
    db.insert(schema.printers).values({ name: "Laden-Drucker", isDefault: true }).run();
  }
  return db;
}

/** Eine Verbindung pro Prozess, überlebt Hot-Reloads in der Entwicklung. */
export function db(): Db {
  if (!globalForDb.__teaDb) globalForDb.__teaDb = openDb(env.databasePath);
  return globalForDb.__teaDb;
}
