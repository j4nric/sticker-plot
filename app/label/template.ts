/** Gestaltungsvorlagen: Variante und einstellbare Parameter. */

export type FontKey = "oswald" | "serif" | "playfair";
export type Variant = "klassisch" | "band" | "minimal";

export const FONTS: Record<FontKey, { label: string; family: string }> = {
  oswald: { label: "Oswald (schmal, kräftig)", family: '"Oswald", "Arial Narrow", sans-serif' },
  serif: { label: "Source Serif (Buchschrift)", family: '"Source Serif 4", Georgia, serif' },
  playfair: { label: "Playfair Display (elegant)", family: '"Playfair Display", Georgia, serif' },
};

export const VARIANTS: Record<Variant, string> = {
  klassisch: "Klassisch – doppelter Rahmen, Motiv im Kreis",
  band: "Band – farbige Fläche oben und unten, ohne Rahmen",
  minimal: "Minimal – feine Linien, viel Weißraum",
};

export interface TemplateParams {
  variant: Variant;
  titleFont: FontKey;
  bodyFont: FontKey;
  titleUppercase: boolean;
  /** Schriftgrößen in pt */
  titleMax: number;
  titleMin: number;
  bodyMax: number;
  bodyMin: number;
  /** Höhe des Motivs in mm, 0 = ohne Motiv */
  artHeight: number;
  showTeaType: boolean;
  showBrew: boolean;
  showCodes: boolean;
  showFooter: boolean;
}

export const DEFAULT_TEMPLATE_PARAMS: TemplateParams = {
  variant: "klassisch",
  titleFont: "oswald",
  bodyFont: "serif",
  titleUppercase: true,
  titleMax: 15,
  titleMin: 8.5,
  bodyMax: 7.4,
  bodyMin: 5.6,
  artHeight: 27,
  showTeaType: true,
  showBrew: true,
  showCodes: true,
  showFooter: true,
};

export const PARAM_LIMITS = {
  titleMax: [8, 22],
  titleMin: [6, 16],
  bodyMax: [5, 10],
  bodyMin: [4.5, 8],
  artHeight: [0, 40],
} as const;

const clamp = (v: unknown, [min, max]: readonly [number, number], fallback: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 10) / 10)) : fallback;
};
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

/** Macht aus beliebigem (gespeichertem) JSON gültige Parameter. */
export function normalizeParams(input: unknown): TemplateParams {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const d = DEFAULT_TEMPLATE_PARAMS;
  const p: TemplateParams = {
    variant: pick(o.variant, Object.keys(VARIANTS) as Variant[], d.variant),
    titleFont: pick(o.titleFont, Object.keys(FONTS) as FontKey[], d.titleFont),
    bodyFont: pick(o.bodyFont, Object.keys(FONTS) as FontKey[], d.bodyFont),
    titleUppercase: bool(o.titleUppercase, d.titleUppercase),
    titleMax: clamp(o.titleMax, PARAM_LIMITS.titleMax, d.titleMax),
    titleMin: clamp(o.titleMin, PARAM_LIMITS.titleMin, d.titleMin),
    bodyMax: clamp(o.bodyMax, PARAM_LIMITS.bodyMax, d.bodyMax),
    bodyMin: clamp(o.bodyMin, PARAM_LIMITS.bodyMin, d.bodyMin),
    artHeight: clamp(o.artHeight, PARAM_LIMITS.artHeight, d.artHeight),
    showTeaType: bool(o.showTeaType, d.showTeaType),
    showBrew: bool(o.showBrew, d.showBrew),
    showCodes: bool(o.showCodes, d.showCodes),
    showFooter: bool(o.showFooter, d.showFooter),
  };
  if (p.titleMin > p.titleMax) p.titleMin = p.titleMax;
  if (p.bodyMin > p.bodyMax) p.bodyMin = p.bodyMax;
  return p;
}

export function parseParams(json: string | null | undefined): TemplateParams {
  try {
    return normalizeParams(json ? JSON.parse(json) : {});
  } catch {
    return normalizeParams({});
  }
}

/** Startwerte für neue Vorlagen je Variante. */
export const VARIANT_PRESETS: Record<Variant, Partial<TemplateParams>> = {
  klassisch: {},
  band: { titleFont: "oswald", artHeight: 25 },
  minimal: { titleFont: "playfair", titleUppercase: false, titleMax: 16, artHeight: 22 },
};
