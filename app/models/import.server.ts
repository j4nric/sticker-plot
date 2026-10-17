import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "~/db/db.server";
import { importItems, type ImportItem } from "~/db/schema";
import type { ImportResult } from "~/lib/import/interpret";

export function addImportItem(fileName: string, source: Buffer, userName: string): number {
  return db().insert(importItems).values({ fileName, source, userName, status: "queued" }).returning({ id: importItems.id }).get().id;
}

export function nextQueued(): ImportItem | undefined {
  return db().select().from(importItems).where(eq(importItems.status, "queued")).orderBy(asc(importItems.id)).limit(1).get();
}

export function setItemStatus(id: number, patch: Partial<Pick<ImportItem, "status" | "error" | "result" | "previewImageId" | "teaId">> & { clearSource?: boolean }) {
  const { clearSource, ...rest } = patch;
  db()
    .update(importItems)
    .set({ ...rest, ...(clearSource ? { source: null } : {}), updatedAt: new Date() })
    .where(eq(importItems.id, id))
    .run();
}

/** Nach einem Neustart hängengebliebene Einträge erneut einreihen. */
export function requeueStale() {
  db().update(importItems).set({ status: "queued" }).where(eq(importItems.status, "processing")).run();
}

export function getImportItem(id: number) {
  return db().select().from(importItems).where(eq(importItems.id, id)).get();
}

export function listImportItems(opts: { open?: boolean } = {}) {
  const rows = db()
    .select({
      id: importItems.id,
      fileName: importItems.fileName,
      status: importItems.status,
      error: importItems.error,
      result: importItems.result,
      previewImageId: importItems.previewImageId,
      teaId: importItems.teaId,
      createdAt: importItems.createdAt,
    })
    .from(importItems)
    .where(opts.open ? inArray(importItems.status, ["queued", "processing", "done", "error"]) : undefined)
    .orderBy(desc(importItems.id))
    .limit(500)
    .all();
  return rows.map((r) => ({ ...r, result: r.result ? (JSON.parse(r.result) as ImportResult) : null }));
}

export function importCounts() {
  const rows = db().select({ status: importItems.status, n: sql<number>`count(*)` }).from(importItems).groupBy(importItems.status).all();
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<ImportItem["status"], number>>;
}

/** Erledigte Einträge (übernommen/verworfen) aufräumen. */
export function clearFinished() {
  db().delete(importItems).where(inArray(importItems.status, ["imported", "skipped"])).run();
}

export function retryItem(id: number) {
  db()
    .update(importItems)
    .set({ status: "queued", error: "" })
    .where(and(eq(importItems.id, id), eq(importItems.status, "error")))
    .run();
}
