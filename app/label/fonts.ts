/** Schriften für das Etikett (SIL Open Font License, Dateien in public/fonts). */
export const LABEL_FONTS = [
  { family: "Oswald", weight: 500, style: "normal", file: "oswald-latin-500-normal.woff2" },
  { family: "Oswald", weight: 600, style: "normal", file: "oswald-latin-600-normal.woff2" },
  { family: "Source Serif 4", weight: 400, style: "normal", file: "source-serif-4-latin-400-normal.woff2" },
  { family: "Source Serif 4", weight: 400, style: "italic", file: "source-serif-4-latin-400-italic.woff2" },
  { family: "Source Serif 4", weight: 600, style: "normal", file: "source-serif-4-latin-600-normal.woff2" },
] as const;

export type LabelFont = (typeof LABEL_FONTS)[number];

export function fontFaceCss(src: (font: LabelFont) => string): string {
  return LABEL_FONTS.map(
    (f) =>
      `@font-face{font-family:"${f.family}";font-style:${f.style};font-weight:${f.weight};font-display:block;src:url(${src(f)}) format("woff2");}`,
  ).join("\n");
}

/** Variante für den Browser: Dateien werden aus /fonts geladen. */
export const browserFontCss = fontFaceCss((f) => `/fonts/${f.file}`);
