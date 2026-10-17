/** Deutsche Zahlen- und Datumsdarstellung an einer Stelle. */

/** Zahl mit fester Anzahl Nachkommastellen, z. B. „1,50“. */
export function formatNumber(v: number, digits = 2): string {
  return v.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Zahl mit höchstens `digits` Nachkommastellen, z. B. „70“ oder „70,5“. */
export function formatCompact(v: number, digits = 2): string {
  return v.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

/** Mit Vorzeichen bei positiven Werten, z. B. „+0,50“. */
export function formatSigned(v: number, digits = 2): string {
  return (v > 0 ? "+" : "") + formatNumber(v, digits);
}

const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });
const logTimeFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "medium" });

type DateLike = Date | number | string;

/** „17.10.2026“ */
export const formatDate = (d: DateLike) => dateFormat.format(new Date(d));
/** „17.10.2026, 18:45“ */
export const formatDateTime = (d: DateLike) => dateTimeFormat.format(new Date(d));
/** „17.10.26, 18:45:12“ (Protokoll) */
export const formatLogTime = (d: DateLike) => logTimeFormat.format(new Date(d));

/** „2027-10-16“ → „16.10.2027“; andere Eingaben bleiben unverändert. */
export function germanDate(s: string | undefined | null): string {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : (s ?? "").trim();
}

/** Akzeptiert deutsche Schreibweise mit Komma. */
export function parseDecimal(value: FormDataEntryValue | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const s = value.trim().replace(/\s/g, "").replace(",", ".").replace("−", "-");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
