import { desc } from "drizzle-orm";
import { db } from "~/db/db.server";
import { auditLog } from "~/db/schema";

export function audit(userName: string, action: string, entity: string, entityId: number | null, summary = "") {
  db().insert(auditLog).values({ userName, action, entity, entityId, summary: summary.slice(0, 500) }).run();
}

export function listAudit(limit = 300) {
  return db().select().from(auditLog).orderBy(desc(auditLog.createdAt), desc(auditLog.id)).limit(limit).all();
}
