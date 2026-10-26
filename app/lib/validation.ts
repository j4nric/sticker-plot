import { z } from "zod";
import { normalizeEan } from "~/label/codes";
import { CALIBRATION_LIMITS, GEOMETRY_FIELDS, MAX_PRINT_LABELS, validateGeometry, type SheetGeometry } from "~/label/geometry";
import { MOTIFS } from "~/label/motifs";
import { TEA_KIND_KEYS, teaTypeLabel, type TeaKind } from "~/label/tea-types";
import { FONTS, normalizeParams, PARAM_LIMITS, VARIANTS, type TemplateParams } from "~/label/template";
import { normalizeParagraphs, unsupportedChars } from "~/label/text";
import { germanDate, parseDecimal } from "./locale";

const printable = (label: string) => (s: string, ctx: z.RefinementCtx) => {
  const bad = unsupportedChars(s);
  if (bad.length) ctx.addIssue({ code: "custom", message: `${label}: Diese Zeichen können nicht gedruckt werden: ${bad.join(" ")}` });
};

const text = (max: number, label: string, multiline = false) =>
  z
    .string()
    .transform((s) => (multiline ? normalizeParagraphs(s) : s.replace(/\s+/g, " ").trim()))
    .pipe(z.string().max(max, `${label}: höchstens ${max} Zeichen`))
    .superRefine(printable(label));

/** „3“ → „3 Min.“, „2-3“ → „2–3 Min.“; freie Texte bleiben unverändert. */
export function normalizeBrewTime(s: string): string {
  const m = s.trim().match(/^(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?\s*(min\.?|minuten)?$/i);
  if (!m) return s.trim();
  return `${m[1]}${m[2] ? `–${m[2]}` : ""} Min.`;
}

/** „3“ → „3 g“; „1 TL / 250 ml“ bleibt. */
export function normalizeBrewAmount(s: string): string {
  const m = s.trim().match(/^(\d+(?:[.,]\d+)?)(?:\s*g)?$/i);
  return m ? `${m[1]} g` : s.trim();
}

const optionalInt = (min: number, max: number, label: string) =>
  z.string().transform((s, ctx) => {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t.replace(",", "."));
    if (!Number.isInteger(n)) {
      ctx.addIssue({ code: "custom", message: `${label}: bitte eine ganze Zahl` });
      return z.NEVER;
    }
    if (n < min || n > max) {
      ctx.addIssue({ code: "custom", message: `${label}: zwischen ${min} und ${max}` });
      return z.NEVER;
    }
    return n;
  });

/** Titel: Zeilenumbrüche erlaubt (erzwingen den Umbruch auf dem Etikett), keine Leerzeilen. */
const titleText = z
  .string()
  .transform((s) => normalizeParagraphs(s).replace(/\n+/g, "\n"))
  .pipe(z.string().max(80, "Titel: höchstens 80 Zeichen"))
  .superRefine(printable("Titel"));

export const teaInput = z
  .object({
  name: text(80, "Name").pipe(z.string().min(1, "Bitte einen Namen eingeben")),
  title: titleText,
  kind: z.enum(TEA_KIND_KEYS as [TeaKind, ...TeaKind[]], { message: "Bitte eine Teeart wählen" }),
  flavored: z.boolean(),
  description: text(1500, "Beschreibung", true),
  ingredients: text(1000, "Zutaten", true),
  motif: z.enum(Object.keys(MOTIFS) as [string, ...string[]]).catch("auto"),
  templateId: z.coerce.number().int().positive().nullable().catch(null),
  brewAmount: text(30, "Menge").transform(normalizeBrewAmount),
  brewTemp: optionalInt(40, 100, "Temperatur"),
  brewTime: text(30, "Ziehzeit").transform(normalizeBrewTime),
  organic: z.boolean(),
  ean: z
    .string()
    .transform((s) => normalizeEan(s))
    .refine((s) => s !== null, "EAN ungültig (8 oder 13 Ziffern, Prüfziffer prüfen)")
    .transform((s) => s ?? ""),
  productUrl: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.union([z.literal(""), z.string().url("Link muss mit https:// beginnen").max(300).refine((u) => /^https?:\/\//.test(u), "Link muss mit https:// beginnen")])),
  price: text(30, "Preis"),
  shelfLifeMonths: optionalInt(1, 120, "Haltbarkeit"),
})
  // Titel gleich Name heißt: kein eigener Titel; Teeart-Text folgt aus Art und Aroma
  .transform((v) => ({ ...v, title: v.title === v.name ? "" : v.title, teaType: teaTypeLabel(v.kind, v.flavored) }));

export type TeaInput = z.infer<typeof teaInput>;

export function readTeaForm(form: FormData) {
  const str = (k: string) => String(form.get(k) ?? "");
  const raw = {
    name: str("name"),
    title: str("title"),
    kind: str("kind"),
    flavored: form.get("flavored") === "on" || form.get("flavored") === "true",
    description: str("description"),
    ingredients: str("ingredients"),
    motif: str("motif") || "auto",
    templateId: str("templateId") || null,
    brewAmount: str("brewAmount"),
    brewTemp: str("brewTemp"),
    brewTime: str("brewTime"),
    organic: form.get("organic") === "on" || form.get("organic") === "true",
    ean: str("ean"),
    productUrl: str("productUrl"),
    price: str("price"),
    shelfLifeMonths: str("shelfLifeMonths"),
  };
  const result = teaInput.safeParse(raw);
  if (result.success) return { ok: true as const, value: result.data, raw };
  const errors: Partial<Record<keyof TeaInput, string>> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof TeaInput;
    errors[key] ??= issue.message;
  }
  return { ok: false as const, errors, raw };
}

export const printRequest = z.object({
  drucker: z.coerce.number().int().positive().optional(),
  format: z.coerce.number().int().positive().optional(),
  anzahl: z.coerce.number().int().min(1).max(MAX_PRINT_LABELS).default(12),
  start: z.coerce.number().int().min(1).max(800).default(1),
  trotzdem: z.string().optional(),
  menge: z.string().max(30).optional(),
  mhd: z.string().max(30).optional(),
  los: z.string().max(30).optional(),
  /** Kennung je Klick auf „PDF erstellen“, damit erneutes Laden nicht doppelt zählt */
  auftrag: z.string().regex(/^[\w-]{8,64}$/).optional(),
});

/** Druckangaben aus der URL der PDF-Routen; null bei ungültigen Angaben. */
export function readPrintQuery(url: URL) {
  const query = Object.fromEntries([...url.searchParams].filter(([k, v]) => v !== "" && k !== "items"));
  const parsed = printRequest.safeParse(query);
  if (!parsed.success) return null;
  const q = parsed.data;
  return {
    count: q.anzahl,
    printerId: q.drucker,
    formatId: q.format,
    start: q.start,
    extras: { netWeight: q.menge?.trim(), bestBefore: germanDate(q.mhd), lot: q.los?.trim() },
    force: q.trotzdem === "1",
    preview: url.searchParams.get("vorschau") === "1",
    jobId: q.auftrag,
  };
}

/** Sammeldruck: „12:3,15:9“ = Tee 12 dreimal, Tee 15 neunmal. */
export function parseMixedItems(value: string | null): { teaId: number; count: number }[] | null {
  if (!value) return null;
  const items: { teaId: number; count: number }[] = [];
  for (const part of value.split(",")) {
    const m = part.trim().match(/^(\d+):(\d+)$/);
    if (!m) return null;
    const count = Number(m[2]);
    if (count < 1 || count > MAX_PRINT_LABELS) return null;
    items.push({ teaId: Number(m[1]), count });
  }
  const total = items.reduce((s, i) => s + i.count, 0);
  return items.length && total <= MAX_PRINT_LABELS ? items : null;
}

/**
 * Liest die vier Ablesewerte vom Testbogen: an welchem Skalenstrich die echte
 * Etikettkante das Kreuz schneidet. Rückgabe als Abweichung des Kreuzes
 * gegenüber der Kante (Vorzeichen umgekehrt).
 */
export function readMeasurement(form: FormData) {
  const fields = ["ax", "ay", "bx", "by"] as const;
  const values = {} as Record<(typeof fields)[number], number>;
  const errors: Partial<Record<(typeof fields)[number], string>> = {};
  for (const f of fields) {
    const v = parseDecimal(form.get(f));
    if (v === null) values[f] = 0;
    else if (Math.abs(v) > 10) errors[f] = "Mehr als 10 mm? Bitte Bogen prüfen.";
    else values[f] = v === 0 ? 0 : -v;
  }
  return { values, errors, ok: Object.keys(errors).length === 0 };
}

export function readCalibration(form: FormData) {
  const L = CALIBRATION_LIMITS;
  const offsetX = parseDecimal(form.get("offsetX"));
  const offsetY = parseDecimal(form.get("offsetY"));
  const scaleX = parseDecimal(form.get("scaleX"));
  const scaleY = parseDecimal(form.get("scaleY"));
  const errors: Record<string, string> = {};
  if (offsetX === null || Math.abs(offsetX) > L.offset) errors.offsetX = `Zahl zwischen −${L.offset} und ${L.offset}`;
  if (offsetY === null || Math.abs(offsetY) > L.offset) errors.offsetY = `Zahl zwischen −${L.offset} und ${L.offset}`;
  const pctMin = L.scaleMin * 100;
  const pctMax = L.scaleMax * 100;
  if (scaleX === null || scaleX < pctMin || scaleX > pctMax) errors.scaleX = `Zahl zwischen ${pctMin} und ${pctMax}`;
  if (scaleY === null || scaleY < pctMin || scaleY > pctMax) errors.scaleY = `Zahl zwischen ${pctMin} und ${pctMax}`;
  if (Object.keys(errors).length) return { ok: false as const, errors };
  return {
    ok: true as const,
    value: { offsetX: offsetX!, offsetY: offsetY!, scaleX: scaleX! / 100, scaleY: scaleY! / 100 },
  };
}

export function readGeometry(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const errors: string[] = [];
  if (!name || name.length > 60) errors.push("Name: 1 bis 60 Zeichen.");
  const g = {} as SheetGeometry;
  for (const f of GEOMETRY_FIELDS) {
    const v = parseDecimal(form.get(f));
    if (v === null) errors.push(`Feld „${f}“ fehlt oder ist keine Zahl.`);
    g[f] = v ?? 0;
  }
  if (!errors.length) errors.push(...validateGeometry(g));
  return { name, geometry: g, errors };
}

export function readTemplateForm(form: FormData): { name: string; params: TemplateParams; errors: string[] } {
  const name = String(form.get("name") ?? "").trim();
  const errors: string[] = [];
  if (!name || name.length > 60) errors.push("Name: 1 bis 60 Zeichen.");
  // fehlende Felder bekommen den Standardwert, nicht das Minimum
  const num = (k: keyof typeof PARAM_LIMITS) => parseDecimal(form.get(k)) ?? undefined;
  const params = normalizeParams({
    variant: String(form.get("variant")) in VARIANTS ? form.get("variant") : undefined,
    titleFont: String(form.get("titleFont")) in FONTS ? form.get("titleFont") : undefined,
    bodyFont: String(form.get("bodyFont")) in FONTS ? form.get("bodyFont") : undefined,
    titleUppercase: form.get("titleUppercase") === "on",
    titleMax: num("titleMax"),
    titleMin: num("titleMin"),
    bodyMax: num("bodyMax"),
    bodyMin: num("bodyMin"),
    typeMax: num("typeMax"),
    typeMin: num("typeMin"),
    footerMax: num("footerMax"),
    footerMin: num("footerMin"),
    artHeight: num("artHeight"),
    showTeaType: form.get("showTeaType") === "on",
    showBrew: form.get("showBrew") === "on",
    showCodes: form.get("showCodes") === "on",
    showFooter: form.get("showFooter") === "on",
  });
  return { name, params, errors };
}

export const passwordRule = z.string().min(8, "Passwort: mindestens 8 Zeichen").max(200);
export const usernameRule = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{2,32}$/, "Benutzername: 2 bis 32 Zeichen, nur a–z, 0–9, Punkt, Strich");
