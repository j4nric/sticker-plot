/** Schriften für das Etikett (SIL Open Font License, Dateien in public/fonts). */

const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

const faces = [
  ["Oswald", 500, "normal", "oswald", "500-normal"],
  ["Oswald", 600, "normal", "oswald", "600-normal"],
  ["Source Serif 4", 400, "normal", "source-serif-4", "400-normal"],
  ["Source Serif 4", 400, "italic", "source-serif-4", "400-italic"],
  ["Source Serif 4", 600, "normal", "source-serif-4", "600-normal"],
  ["Playfair Display", 600, "normal", "playfair-display", "600-normal"],
  ["Playfair Display", 400, "italic", "playfair-display", "400-italic"],
] as const;

export const LABEL_FONTS = faces.flatMap(([family, weight, style, slug, variant]) => [
  { family, weight, style, file: `${slug}-latin-${variant}.woff2`, unicodeRange: LATIN },
  { family, weight, style, file: `${slug}-latin-ext-${variant}.woff2`, unicodeRange: LATIN_EXT },
]);

export type LabelFont = (typeof LABEL_FONTS)[number];

export function fontFaceCss(src: (font: LabelFont) => string, fonts: readonly LabelFont[] = LABEL_FONTS): string {
  return fonts.map(
    (f) =>
      `@font-face{font-family:"${f.family}";font-style:${f.style};font-weight:${f.weight};font-display:block;src:url(${src(f)}) format("woff2");unicode-range:${f.unicodeRange};}`,
  ).join("\n");
}

/** Variante für den Browser: Dateien werden aus /fonts geladen. */
export const browserFontCss = fontFaceCss((f) => `/fonts/${f.file}`);
