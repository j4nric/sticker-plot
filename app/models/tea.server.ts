import { and, desc, eq, isNotNull, isNull, like, or, sql } from "drizzle-orm";
import { db } from "~/db/db.server";
import { printJobs, teas, type Tea } from "~/db/schema";
import { deleteUnusedImages } from "./image.server";
import type { LabelContent } from "~/label/Label";
import type { TeaInput } from "~/lib/validation";

export function listTeas(opts: { query?: string; archived?: boolean } = {}) {
  const q = opts.query?.trim();
  const lastPrinted = db()
    .select({ teaId: printJobs.teaId, at: sql<number>`max(${printJobs.createdAt})`.as("at") })
    .from(printJobs)
    .groupBy(printJobs.teaId)
    .as("last_printed");
  const rows = db()
    .select({
      id: teas.id,
      name: teas.name,
      teaType: teas.teaType,
      color: teas.color,
      updatedAt: teas.updatedAt,
      archivedAt: teas.archivedAt,
      lastPrintedAt: lastPrinted.at,
    })
    .from(teas)
    .leftJoin(lastPrinted, eq(lastPrinted.teaId, teas.id))
    .where(
      and(
        opts.archived ? isNotNull(teas.archivedAt) : isNull(teas.archivedAt),
        q ? or(like(teas.name, `%${q}%`), like(teas.teaType, `%${q}%`), like(teas.description, `%${q}%`)) : undefined,
      ),
    )
    .orderBy(sql`lower(${teas.name})`)
    .all();
  return rows.map((r) => ({ ...r, lastPrintedAt: r.lastPrintedAt ? new Date(r.lastPrintedAt * 1000) : null }));
}

export function countArchived(): number {
  return db().select({ n: sql<number>`count(*)` }).from(teas).where(isNotNull(teas.archivedAt)).get()?.n ?? 0;
}

export function getTea(id: number): Tea | undefined {
  return db().select().from(teas).where(eq(teas.id, id)).get();
}

export function allTeas(): Tea[] {
  return db().select().from(teas).orderBy(sql`lower(${teas.name})`).all();
}

export function findTeaByName(name: string): Tea | undefined {
  return db()
    .select()
    .from(teas)
    .where(sql`lower(${teas.name}) = lower(${name.trim()})`)
    .get();
}

export function createTea(input: Partial<TeaInput> & Pick<TeaInput, "name">): Tea {
  return db().insert(teas).values(input).returning().get();
}

export function updateTea(id: number, input: Partial<TeaInput>): void {
  db()
    .update(teas)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(teas.id, id))
    .run();
}

export function setTeaImage(id: number, imageId: number | null) {
  db().update(teas).set({ imageId, updatedAt: new Date() }).where(eq(teas.id, id)).run();
}

export function archiveTea(id: number, archived: boolean) {
  db()
    .update(teas)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(eq(teas.id, id))
    .run();
}

export function deleteTea(id: number): void {
  db().delete(teas).where(eq(teas.id, id)).run();
  deleteUnusedImages();
}

/** Kopie mit allen Feldern, Name mit Zusatz „(Kopie)“. Ein eigenes Bild teilen sich beide. */
export function duplicateTea(id: number): Tea | undefined {
  const t = getTea(id);
  if (!t) return undefined;
  const { id: _id, createdAt: _c, updatedAt: _u, archivedAt: _a, ...rest } = t;
  let name = `${t.name} (Kopie)`.slice(0, 80);
  for (let i = 2; findTeaByName(name); i++) name = `${t.name} (Kopie ${i})`.slice(0, 80);
  return db().insert(teas).values({ ...rest, name }).returning().get();
}

export function recordPrintJob(job: { teaId: number | null; teaName: string; printerId: number; labelCount: number; startPosition: number; userName: string }) {
  db().insert(printJobs).values(job).run();
}

export function lastPrintJobs(teaId: number, limit = 5) {
  return db().select().from(printJobs).where(eq(printJobs.teaId, teaId)).orderBy(desc(printJobs.createdAt), desc(printJobs.id)).limit(limit).all();
}

/** Felder einer Sorte für das Etikett. */
export function toLabelContent(t: Tea, imageSrc: string | null): LabelContent {
  return {
    name: t.name,
    teaType: t.teaType,
    description: t.description,
    ingredients: t.ingredients,
    color: t.color,
    motif: t.motif,
    imageSrc,
    brewAmount: t.brewAmount,
    brewTemp: t.brewTemp,
    brewTime: t.brewTime,
    organic: t.organic,
    ean: t.ean,
    productUrl: t.productUrl,
    price: t.price,
  };
}
