import { z } from "zod";
import { CALIBRATION_LIMITS, LABELS_PER_SHEET } from "~/label/geometry";

/** Akzeptiert deutsche Schreibweise mit Komma. */
export function parseDecimal(value: FormDataEntryValue | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const s = value.trim().replace(/\s/g, "").replace(",", ".").replace("−", "-");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const text = (max: number, label: string) =>
  z
    .string()
    .transform((s) => s.replace(/\r\n/g, "\n").trim())
    .pipe(z.string().max(max, `${label}: höchstens ${max} Zeichen`));

export const teaInput = z.object({
  name: text(60, "Name").pipe(z.string().min(1, "Bitte einen Namen eingeben")),
  teaType: text(40, "Teeart"),
  description: text(600, "Beschreibung"),
  ingredients: text(400, "Zutaten"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ungültige Farbe").transform((s) => s.toLowerCase()),
});

export type TeaInput = z.infer<typeof teaInput>;

export function readTeaForm(form: FormData) {
  const raw = {
    name: String(form.get("name") ?? ""),
    teaType: String(form.get("teaType") ?? ""),
    description: String(form.get("description") ?? ""),
    ingredients: String(form.get("ingredients") ?? ""),
    color: String(form.get("color") ?? ""),
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
  anzahl: z.coerce.number().int().min(1).max(LABELS_PER_SHEET * 20).default(LABELS_PER_SHEET),
  start: z.coerce.number().int().min(1).max(LABELS_PER_SHEET).default(1),
});

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
