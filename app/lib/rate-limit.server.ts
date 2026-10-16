/**
 * Einfache Sperre gegen das Durchprobieren von Passwörtern:
 * nach 5 Fehlversuchen je Benutzername und Adresse 10 Minuten gesperrt.
 */
const MAX_FAILURES = 5;
const LOCK_MS = 10 * 60 * 1000;

const attempts = new Map<string, { failures: number; lockedUntil: number }>();

export function clientKey(request: Request, username: string): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "lokal";
  return `${ip}|${username.trim().toLowerCase()}`;
}

/** Restliche Sperrzeit in Minuten oder 0. */
export function lockedMinutes(key: string, now = Date.now()): number {
  const a = attempts.get(key);
  if (!a || a.lockedUntil <= now) return 0;
  return Math.ceil((a.lockedUntil - now) / 60000);
}

export function registerFailure(key: string, now = Date.now()) {
  const a = attempts.get(key) ?? { failures: 0, lockedUntil: 0 };
  if (a.lockedUntil && a.lockedUntil <= now) {
    a.failures = 0;
    a.lockedUntil = 0;
  }
  a.failures++;
  if (a.failures >= MAX_FAILURES) a.lockedUntil = now + LOCK_MS;
  attempts.set(key, a);
  if (attempts.size > 5000) attempts.clear();
}

export function registerSuccess(key: string) {
  attempts.delete(key);
}
