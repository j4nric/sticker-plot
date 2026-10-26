import { and, desc, eq, isNotNull, isNull, like, or, sql } from "drizzle-orm";
import { db } from "~/db/db.server";
import { printJobs, teas, type Tea } from "~/db/schema";
import { deleteUnusedImages } from "./image.server";
import type { LabelContent } from "~/label/Label";
import { isTeaKind } from "~/label/tea-types";
import type { TeaSort } from "~/lib/tea-sort";
import type { KindSettings } from "./settings.server";
import type { TeaInput } from "~/lib/validation";

export function listTeas(opts: { query?: string; archived?: boolean; sort?: TeaSort } = {}) {
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
      title: teas.title,
      kind: teas.kind,
      teaType: teas.teaType,
      color: teas.color,
      createdAt: teas.createdAt,
      updatedAt: teas.updatedAt,
      archivedAt: teas.archivedAt,
      lastPrintedAt: lastPrinted.at,
    })
    .from(teas)
    .leftJoin(lastPrinted, eq(lastPrinted.teaId, teas.id))
    .where(
      and(
        opts.archived ? isNotNull(teas.archivedAt) : isNull(teas.archivedAt),
        q ? or(like(teas.name, `%${q}%`), like(teas.title, `%${q}%`), like(teas.teaType, `%${q}%`), like(teas.description, `%${q}%`)) : undefined,
      ),
    )
    .orderBy(...teaOrder(opts.sort ?? "name", lastPrinted.at))
    .all();
  return rows.map((r) => ({ ...r, lastPrintedAt: r.lastPrintedAt ? new Date(r.lastPrintedAt * 1000) : null }));
}

function teaOrder(sort: TeaSort, lastPrintedAt: unknown) {
  const byName = sql`lower(${teas.name})`;
  switch (sort) {
    case "name-ab":
      return [sql`lower(${teas.name}) desc`];
    case "neu":
      return [desc(teas.createdAt), desc(teas.id)];
    case "alt":
      return [teas.createdAt, teas.id];
    case "gedruckt":
      return [sql`${lastPrintedAt} is null`, sql`${lastPrintedAt} desc`, byName];
    case "art":
      return [sql`${teas.kind} = ''`, teas.kind, teas.flavored, byName];
    default:
      return [byName];
  }
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

type TeaWrite = Partial<Omit<typeof teas.$inferInsert, "id" | "createdAt" | "updatedAt">>;

export function createTea(input: TeaWrite & Pick<TeaInput, "name">): Tea {
  return db().insert(teas).values(input).returning().get();
}

export function updateTea(id: number, input: TeaWrite): void {
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

/**
 * Kopie mit allen Feldern. Der Name bekommt den Zusatz „(Kopie)“, der Titel
 * auf dem Etikett bleibt gleich. Ein eigenes Bild teilen sich beide.
 */
export function duplicateTea(id: number): Tea | undefined {
  const t = getTea(id);
  if (!t) return undefined;
  const { id: _id, createdAt: _c, updatedAt: _u, archivedAt: _a, ...rest } = t;
  let name = `${t.name} (Kopie)`.slice(0, 80);
  for (let i = 2; findTeaByName(name); i++) name = `${t.name} (Kopie ${i})`.slice(0, 80);
  return db()
    .insert(teas)
    .values({ ...rest, name, title: labelTitle(t) })
    .returning()
    .get();
}

/** Titel auf dem Etikett: eigener Titel, sonst der Name. */
export const labelTitle = (t: Pick<Tea, "title" | "name">) => t.title.trim() || t.name;

export function recordPrintJob(job: { teaId: number | null; teaName: string; printerId: number; labelCount: number; startPosition: number; userName: string }) {
  db().insert(printJobs).values(job).run();
}

export function lastPrintJobs(teaId: number, limit = 5) {
  return db().select().from(printJobs).where(eq(printJobs.teaId, teaId)).orderBy(desc(printJobs.createdAt), desc(printJobs.id)).limit(limit).all();
}

/** Farbe einer Sorte: fest je Teeart aus den Einstellungen, bei alten Sorten die eigene. */
export function teaColor(t: Pick<Tea, "kind" | "color">, kinds: KindSettings): string {
  return isTeaKind(t.kind) ? kinds[t.kind].color : t.color;
}

/**
 * Felder einer Sorte für das Etikett. `imageSrc` ist das eigene Bild der
 * Sorte, `kindImageSrc` das zentrale Motiv ihrer Teeart.
 */
export function toLabelContent(t: Tea, kinds: KindSettings, images: { imageSrc: string | null; kindImageSrc: string | null }): LabelContent {
  return {
    name: labelTitle(t),
    teaType: t.teaType,
    kind: t.kind,
    description: t.description,
    ingredients: t.ingredients,
    color: teaColor(t, kinds),
    motif: t.motif,
    imageSrc: images.imageSrc,
    kindImageSrc: images.kindImageSrc,
    brewAmount: t.brewAmount,
    brewTemp: t.brewTemp,
    brewTime: t.brewTime,
    organic: t.organic,
    ean: t.ean,
    productUrl: t.productUrl,
    price: t.price,
  };
}

/** Etikettinhalt für die Vorschau im Browser (Bilder per URL statt eingebettet). */
export function previewLabelContent(t: Tea, kinds: KindSettings): LabelContent {
  const kindImageId = isTeaKind(t.kind) ? kinds[t.kind].imageId : null;
  return toLabelContent(t, kinds, { imageSrc: t.imageId ? `/bilder/${t.imageId}` : null, kindImageSrc: kindImageId ? `/bilder/${kindImageId}` : null });
}
