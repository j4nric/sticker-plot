import { desc, eq, like, or, sql } from "drizzle-orm";
import { db } from "~/db/db.server";
import { printJobs, teas, type Tea } from "~/db/schema";
import type { TeaInput } from "~/lib/validation";

export function listTeas(query?: string) {
  const q = query?.trim();
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
      lastPrintedAt: lastPrinted.at,
    })
    .from(teas)
    .leftJoin(lastPrinted, eq(lastPrinted.teaId, teas.id))
    .where(q ? or(like(teas.name, `%${q}%`), like(teas.teaType, `%${q}%`)) : undefined)
    .orderBy(sql`lower(${teas.name})`)
    .all();
  return rows.map((r) => ({ ...r, lastPrintedAt: r.lastPrintedAt ? new Date(r.lastPrintedAt * 1000) : null }));
}

export function getTea(id: number): Tea | undefined {
  return db().select().from(teas).where(eq(teas.id, id)).get();
}

export function createTea(input: TeaInput): Tea {
  return db().insert(teas).values(input).returning().get();
}

export function updateTea(id: number, input: TeaInput): void {
  db()
    .update(teas)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(teas.id, id))
    .run();
}

export function deleteTea(id: number): void {
  db().delete(teas).where(eq(teas.id, id)).run();
}

export function recordPrintJob(job: { teaId: number; teaName: string; printerId: number; labelCount: number; startPosition: number }) {
  db().insert(printJobs).values(job).run();
}

export function lastPrintJobs(teaId: number, limit = 5) {
  return db().select().from(printJobs).where(eq(printJobs.teaId, teaId)).orderBy(desc(printJobs.createdAt), desc(printJobs.id)).limit(limit).all();
}
