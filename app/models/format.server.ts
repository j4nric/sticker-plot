import { asc, count, desc, eq, ne } from "drizzle-orm";
import { db } from "~/db/db.server";
import { sheetFormats, type SheetFormatRow } from "~/db/schema";
import type { SheetGeometry } from "~/label/geometry";

export type SheetFormat = SheetGeometry & { id: number; name: string; isDefault: boolean };

export function toFormat(r: SheetFormatRow): SheetFormat {
  const { id, name, isDefault, pageWidth, pageHeight, columns, rows, labelWidth, labelHeight, originX, originY, pitchX, pitchY } = r;
  return { id, name, isDefault, pageWidth, pageHeight, columns, rows, labelWidth, labelHeight, originX, originY, pitchX, pitchY };
}

export function listFormats(): SheetFormat[] {
  return db().select().from(sheetFormats).orderBy(desc(sheetFormats.isDefault), asc(sheetFormats.name)).all().map(toFormat);
}

export function getFormat(id: number): SheetFormat | undefined {
  const r = db().select().from(sheetFormats).where(eq(sheetFormats.id, id)).get();
  return r ? toFormat(r) : undefined;
}

/** Gewünschtes Format oder das Standardformat. */
export function resolveFormat(id?: number | null): SheetFormat {
  return (id ? getFormat(id) : undefined) ?? listFormats()[0]!;
}

export function saveFormat(id: number | null, name: string, g: SheetGeometry): SheetFormat {
  if (id) {
    db().update(sheetFormats).set({ name, ...g, updatedAt: new Date() }).where(eq(sheetFormats.id, id)).run();
    return getFormat(id)!;
  }
  return toFormat(db().insert(sheetFormats).values({ name, ...g }).returning().get());
}

export function setDefaultFormat(id: number) {
  db().transaction((tx) => {
    tx.update(sheetFormats).set({ isDefault: false }).where(ne(sheetFormats.id, id)).run();
    tx.update(sheetFormats).set({ isDefault: true }).where(eq(sheetFormats.id, id)).run();
  });
}

export function deleteFormat(id: number): boolean {
  const total = db().select({ n: count() }).from(sheetFormats).get()?.n ?? 0;
  if (total <= 1) return false;
  const wasDefault = getFormat(id)?.isDefault;
  db().delete(sheetFormats).where(eq(sheetFormats.id, id)).run();
  if (wasDefault) setDefaultFormat(listFormats()[0]!.id);
  return true;
}
