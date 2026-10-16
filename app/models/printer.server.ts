import { asc, count, desc, eq, ne } from "drizzle-orm";
import { db } from "~/db/db.server";
import { printers, type Printer } from "~/db/schema";
import type { Calibration } from "~/label/geometry";

export function listPrinters(): Printer[] {
  return db().select().from(printers).orderBy(desc(printers.isDefault), asc(printers.name)).all();
}

export function getPrinter(id: number): Printer | undefined {
  return db().select().from(printers).where(eq(printers.id, id)).get();
}

/** Gewünschter Drucker oder der Standarddrucker als Rückfall. */
export function resolvePrinter(id?: number): Printer {
  const p = id ? getPrinter(id) : undefined;
  return p ?? listPrinters()[0]!;
}

export function toCalibration(p: Printer): Calibration {
  return { offsetX: p.offsetX, offsetY: p.offsetY, scaleX: p.scaleX, scaleY: p.scaleY };
}

export function createPrinter(name: string): Printer {
  return db().insert(printers).values({ name }).returning().get();
}

export function renamePrinter(id: number, name: string) {
  db().update(printers).set({ name, updatedAt: new Date() }).where(eq(printers.id, id)).run();
}

export function setCalibration(id: number, c: Calibration) {
  db()
    .update(printers)
    .set({ ...c, updatedAt: new Date() })
    .where(eq(printers.id, id))
    .run();
}

export function setNextSlot(id: number, slot: number) {
  db().update(printers).set({ nextSlot: Math.max(1, Math.floor(slot)) }).where(eq(printers.id, id)).run();
}

export function setDefaultPrinter(id: number) {
  db().transaction((tx) => {
    tx.update(printers).set({ isDefault: false }).where(ne(printers.id, id)).run();
    tx.update(printers).set({ isDefault: true }).where(eq(printers.id, id)).run();
  });
}

/** Löscht einen Drucker, solange mindestens einer übrig bleibt. */
export function deletePrinter(id: number): boolean {
  const total = db().select({ n: count() }).from(printers).get()?.n ?? 0;
  if (total <= 1) return false;
  const wasDefault = getPrinter(id)?.isDefault;
  db().delete(printers).where(eq(printers.id, id)).run();
  if (wasDefault) {
    const next = listPrinters()[0];
    if (next) setDefaultPrinter(next.id);
  }
  return true;
}
