import { createHash } from "node:crypto";
import { createCookieSessionStorage, data, redirect, type MiddlewareFunction, type RouterContextProvider } from "react-router";
import type { User } from "~/db/schema";
import { getUser, toSessionUser, type SessionUser } from "~/models/user.server";
import { userContext } from "./context";
import { env } from "./env.server";

/** `pw`: Fingerabdruck des Passwort-Hashes, siehe passwordFingerprint */
type SessionData = { userId: number; pw: string };
type FlashData = { error: string };

let storage: ReturnType<typeof createCookieSessionStorage<SessionData, FlashData>> | undefined;

function sessionStorage() {
  storage ??= createCookieSessionStorage<SessionData, FlashData>({
    cookie: {
      name: "__tee_session",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secrets: [env.sessionSecret],
      secure: env.cookieSecure,
      maxAge: 60 * 60 * 24 * 30,
    },
  });
  return storage;
}

export function getSession(request: Request) {
  return sessionStorage().getSession(request.headers.get("Cookie"));
}
export const commitSession: ReturnType<typeof sessionStorage>["commitSession"] = (...args) => sessionStorage().commitSession(...args);
export const destroySession: ReturnType<typeof sessionStorage>["destroySession"] = (...args) => sessionStorage().destroySession(...args);

/**
 * Kurzer Fingerabdruck des Passwort-Hashes. Steht mit im Cookie: Ändert sich
 * das Passwort oder wird eine Sicherung mit anderen Zugängen eingespielt,
 * passen bestehende Anmeldungen nicht mehr und gelten als abgemeldet.
 */
export function passwordFingerprint(user: Pick<User, "passwordHash">): string {
  return createHash("sha256").update(user.passwordHash).digest("base64url").slice(0, 16);
}

/** Cookie für eine frische Anmeldung dieses Benutzers. */
export async function loginCookie(request: Request, user: User): Promise<string> {
  const session = await getSession(request);
  session.set("userId", user.id);
  session.set("pw", passwordFingerprint(user));
  return commitSession(session);
}

/** Benutzer aus dem Cookie; deaktivierte, gelöschte oder geänderte Konten gelten als abgemeldet. */
export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const session = await getSession(request);
  const id = session.get("userId");
  if (typeof id !== "number") return null;
  const user = getUser(id);
  if (!user || !user.active || session.get("pw") !== passwordFingerprint(user)) return null;
  return toSessionUser(user);
}

/** Nur relative Pfade innerhalb der App zulassen. */
export function safeRedirectTarget(target: string | null | undefined, fallback = "/"): string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return fallback;
  return target;
}

export const requireLogin: MiddlewareFunction<Response> = async ({ request, context }) => {
  const user = await getSessionUser(request);
  if (user) {
    context.set(userContext, user);
    return;
  }
  const url = new URL(request.url);
  const params = new URLSearchParams({ redirectTo: url.pathname + url.search });
  throw redirect(`/login?${params}`);
};

export const requireAdmin: MiddlewareFunction<Response> = async ({ context }) => {
  if (context.get(userContext)?.role !== "admin") throw data("Dieser Bereich ist nur für Administratoren.", { status: 403 });
};

/** Angemeldeter Benutzer in Loadern und Actions (Middleware hat ihn gesetzt). */
export function currentUser(context: Readonly<RouterContextProvider>): SessionUser {
  const user = context.get(userContext);
  if (!user) throw redirect("/login");
  return user;
}

