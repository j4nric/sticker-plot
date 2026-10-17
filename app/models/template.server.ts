import { asc, count, desc, eq, ne } from "drizzle-orm";
import { db } from "~/db/db.server";
import { templates } from "~/db/schema";
import { parseParams, type TemplateParams } from "~/label/template";

export interface LabelTemplate {
  id: number;
  name: string;
  isDefault: boolean;
  params: TemplateParams;
}

export function listTemplates(): LabelTemplate[] {
  return db()
    .select()
    .from(templates)
    .orderBy(desc(templates.isDefault), asc(templates.name))
    .all()
    .map((r) => ({ id: r.id, name: r.name, isDefault: r.isDefault, params: parseParams(r.params) }));
}

export function getTemplate(id: number): LabelTemplate | undefined {
  const r = db().select().from(templates).where(eq(templates.id, id)).get();
  return r ? { id: r.id, name: r.name, isDefault: r.isDefault, params: parseParams(r.params) } : undefined;
}

export function resolveTemplate(id?: number | null): LabelTemplate {
  return (id ? getTemplate(id) : undefined) ?? listTemplates()[0]!;
}

export function saveTemplate(id: number | null, name: string, params: TemplateParams): LabelTemplate {
  if (id) {
    db().update(templates).set({ name, params: JSON.stringify(params), updatedAt: new Date() }).where(eq(templates.id, id)).run();
    return getTemplate(id)!;
  }
  const r = db().insert(templates).values({ name, params: JSON.stringify(params) }).returning().get();
  return getTemplate(r.id)!;
}

export function setDefaultTemplate(id: number) {
  db().transaction((tx) => {
    tx.update(templates).set({ isDefault: false }).where(ne(templates.id, id)).run();
    tx.update(templates).set({ isDefault: true }).where(eq(templates.id, id)).run();
  });
}

export function deleteTemplate(id: number): boolean {
  const total = db().select({ n: count() }).from(templates).get()?.n ?? 0;
  if (total <= 1) return false;
  const wasDefault = getTemplate(id)?.isDefault;
  db().delete(templates).where(eq(templates.id, id)).run();
  if (wasDefault) setDefaultTemplate(listTemplates()[0]!.id);
  return true;
}
