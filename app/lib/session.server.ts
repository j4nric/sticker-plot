import { createHash, timingSafeEqual } from "node:crypto";
import { createCookieSessionStorage, redirect, type MiddlewareFunction } from "react-router";
import { env } from "./env.server";

type SessionData = { loggedIn: boolean };
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
export const commitSession: ReturnType<typeof sessionStorage>["commitSession"] = (...args) =>
  sessionStorage().commitSession(...args);
export const destroySession: ReturnType<typeof sessionStorage>["destroySession"] = (...args) =>
  sessionStorage().destroySession(...args);

export async function isLoggedIn(request: Request): Promise<boolean> {
  const session = await getSession(request);
  return session.get("loggedIn") === true;
}

export function checkPassword(input: string): boolean {
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(env.appPassword).digest();
  return timingSafeEqual(a, b);
}

/** Nur relative Pfade innerhalb der App zulassen. */
export function safeRedirectTarget(target: string | null | undefined, fallback = "/"): string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return fallback;
  return target;
}

export const requireLogin: MiddlewareFunction<Response> = async ({ request }) => {
  if (await isLoggedIn(request)) return;
  const url = new URL(request.url);
  const params = new URLSearchParams({ redirectTo: url.pathname + url.search });
  throw redirect(`/login?${params}`);
};
