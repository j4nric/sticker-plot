/**
 * Sperre gegen das Durchprobieren von Passwörtern:
 * - 5 Fehlversuche je Benutzername und Adresse → 10 Minuten gesperrt
 * - 20 Fehlversuche je Benutzername von beliebigen Adressen → ebenso
 *
 * Die Adresse setzt server.mjs aus der von Express ermittelten Client-IP
 * (trust proxy) in einen eigenen Header; einen vom Client mitgeschickten
 * Wert überschreibt er. X-Forwarded-For selbst ist frei fälschbar.
 */
export const CLIENT_IP_HEADER = "x-tee-client-ip";

const LIMITS = { c: 5, u: 20 } as const;
const LOCK_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 5000;

const attempts = new Map<string, { failures: number; lockedUntil: number; last: number }>();

/** Schlüssel für Adresse+Name und für den Namen allein. */
export function loginKeys(request: Request, username: string): string[] {
  const ip = request.headers.get(CLIENT_IP_HEADER) || "lokal";
  const name = username.trim().toLowerCase();
  return [`c|${ip}|${name}`, `u|${name}`];
}

/** Restliche Sperrzeit in Minuten oder 0. */
export function lockedMinutes(keys: string[], now = Date.now()): number {
  let until = 0;
  for (const key of keys) until = Math.max(until, attempts.get(key)?.lockedUntil ?? 0);
  return until > now ? Math.ceil((until - now) / 60000) : 0;
}

/** Abgelaufene Einträge entfernen; bleibt es zu voll, die ältesten. */
function prune(now: number) {
  if (attempts.size <= MAX_ENTRIES) return;
  for (const [key, a] of attempts) if (a.lockedUntil <= now && now - a.last > LOCK_MS) attempts.delete(key);
  for (const key of attempts.keys()) {
    if (attempts.size <= MAX_ENTRIES) break;
    attempts.delete(key);
  }
}

export function registerFailure(keys: string[], now = Date.now()) {
  for (const key of keys) {
    const a = attempts.get(key) ?? { failures: 0, lockedUntil: 0, last: now };
    if ((a.lockedUntil && a.lockedUntil <= now) || now - a.last > LOCK_MS) {
      a.failures = 0;
      a.lockedUntil = 0;
    }
    a.failures++;
    a.last = now;
    if (a.failures >= LIMITS[key[0] as keyof typeof LIMITS]) a.lockedUntil = now + LOCK_MS;
    attempts.delete(key);
    attempts.set(key, a);
  }
  prune(now);
}

export function registerSuccess(keys: string[]) {
  for (const key of keys) attempts.delete(key);
}
