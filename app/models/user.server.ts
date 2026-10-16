import { asc, and, count, eq, ne } from "drizzle-orm";
import { db } from "~/db/db.server";
import { users, type User } from "~/db/schema";
import { hashPassword, verifyPassword } from "~/lib/password.server";

export type Role = User["role"];
export interface SessionUser {
  id: number;
  username: string;
  displayName: string;
  role: Role;
}

export const toSessionUser = (u: User): SessionUser => ({ id: u.id, username: u.username, displayName: u.displayName || u.username, role: u.role });

export function listUsers() {
  return db().select().from(users).orderBy(asc(users.username)).all();
}

export function getUser(id: number): User | undefined {
  return db().select().from(users).where(eq(users.id, id)).get();
}

export function findUserByName(username: string): User | undefined {
  return db().select().from(users).where(eq(users.username, username.trim().toLowerCase())).get();
}

export function authenticate(username: string, password: string): User | null {
  const u = findUserByName(username);
  if (!u || !u.active || !verifyPassword(password, u.passwordHash)) return null;
  db().update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id)).run();
  return u;
}

export function createUser(input: { username: string; displayName: string; role: Role; password: string }): User {
  return db()
    .insert(users)
    .values({ username: input.username.trim().toLowerCase(), displayName: input.displayName.trim(), role: input.role, passwordHash: hashPassword(input.password) })
    .returning()
    .get();
}

export function updateUser(id: number, input: { displayName: string; role: Role; active: boolean }) {
  db().update(users).set({ ...input, updatedAt: new Date() }).where(eq(users.id, id)).run();
}

export function setPassword(id: number, password: string) {
  db().update(users).set({ passwordHash: hashPassword(password), updatedAt: new Date() }).where(eq(users.id, id)).run();
}

/** Mindestens ein aktiver Admin muss bleiben. */
export function isLastActiveAdmin(id: number): boolean {
  const others = db()
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.active, true), ne(users.id, id)))
    .get()?.n;
  return (others ?? 0) === 0;
}

export function deleteUser(id: number) {
  db().delete(users).where(eq(users.id, id)).run();
}
