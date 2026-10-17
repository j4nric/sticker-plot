import hyphenDe from "hyphen/de";

// CommonJS-Paket: Standardimport funktioniert in Node (ESM) und im Browser-Bundle
const { hyphenateSync } = hyphenDe;

/**
 * Setzt weiche Trennstriche (U+00AD) nach deutschen Trennregeln.
 * Vorschau und PDF trennen damit an genau denselben Stellen, unabhängig
 * davon, ob der jeweilige Browser selbst trennen kann.
 */
export function hyphenate(text: string, minWordLength = 6): string {
  if (!text) return text;
  return text
    .split(/(\s+|https?:\/\/\S+|www\.\S+)/)
    .map((part) => (/^(\s+|https?:\/\/\S+|www\.\S+)$/.test(part) || part === "" ? part : hyphenateSync(part, { minWordLength })))
    .join("");
}

/** Zeilenenden vereinheitlichen, Leerzeichen am Zeilenrand und mehr als eine Leerzeile entfernen. */
export function normalizeParagraphs(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface MarkupSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

/** Formatierungszeichen: *fett*, _kursiv_, ++unterstrichen++ (beliebig kombinierbar). */
export const MARKUP = {
  bold: "*",
  italic: "_",
  underline: "++",
} as const;

type Style = keyof typeof MARKUP;

/**
 * Zerlegt Text mit Formatierungszeichen in Abschnitte. Zeichen ohne passendes
 * Gegenstück (z. B. ein einzelnes Sternchen) bleiben als normaler Text stehen.
 */
export function parseMarkup(text: string): MarkupSegment[] {
  // Fundstellen je Format sammeln; „++“ vor „*“ und „_“ prüfen
  const found: Record<Style, number[]> = { bold: [], italic: [], underline: [] };
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith(MARKUP.underline, i)) {
      found.underline.push(i);
      i += MARKUP.underline.length - 1;
    } else if (text[i] === MARKUP.bold) found.bold.push(i);
    else if (text[i] === MARKUP.italic) found.italic.push(i);
  }
  // nacheinander paaren; leere Paare und Einzelzeichen bleiben Text
  const toggles = new Map<number, Style>();
  for (const style of Object.keys(found) as Style[]) {
    const pos = found[style];
    const len = MARKUP[style].length;
    for (let k = 0; k + 1 < pos.length; k += 2) {
      const open = pos[k]!;
      const close = pos[k + 1]!;
      if (close - open - len <= 0 || !text.slice(open + len, close).trim()) continue;
      toggles.set(open, style);
      toggles.set(close, style);
    }
  }
  const segments: MarkupSegment[] = [];
  const state = { bold: false, italic: false, underline: false };
  let buf = "";
  const flush = () => {
    if (buf) segments.push({ text: buf, ...state });
    buf = "";
  };
  for (let i = 0; i < text.length; i++) {
    const style = toggles.get(i);
    if (style) {
      flush();
      state[style] = !state[style];
      i += MARKUP[style].length - 1;
    } else buf += text[i];
  }
  flush();
  return segments;
}

/** Text ohne Formatierungszeichen (z. B. für Längenprüfung oder Suche). */
export function stripMarkup(text: string): string {
  return parseMarkup(text)
    .map((s) => s.text)
    .join("");
}

/** @deprecated Kompatibilität: nur fett */
export function parseEmphasis(text: string): { text: string; bold: boolean }[] {
  return parseMarkup(text).map(({ text: t, bold }) => ({ text: t, bold }));
}

/**
 * Zeichen, die die Etikettschriften enthalten: lateinische Buchstaben mit
 * Akzenten, Ziffern und übliche Satzzeichen. Alles andere (Emoji, CJK …)
 * würde als leeres Kästchen gedruckt.
 */
const SUPPORTED = /^[\p{Script=Latin}\p{M}\p{Nd}\s.,;:!?¡¿\-‐‑–—_()[\]{}/\\'"„“”‚‘’«»‹›…·•*&%+=<>#@§$€£¢¥°´`^~|×÷±½¼¾²³¹µ‰™®©]$/u;

export function unsupportedChars(text: string): string[] {
  const bad = new Set<string>();
  for (const ch of text) if (!SUPPORTED.test(ch)) bad.add(ch);
  return [...bad];
}

const KEEP_UPPER = /^(S?F?T?G?F?OP\d?|BOP|BOPF|OP|FOP|PF|CTC|BP|II|III|IV|EU|USA|UK|BIO)$/;
const LOWER_WORDS = new Set(["und", "mit", "von", "vom", "der", "die", "das", "aus", "im", "in", "am", "an", "auf", "&"]);

/** „CHINA SENCHA“ → „China Sencha“, „ROOIBOS VANILLE-KARAMELL“ → „Rooibos Vanille-Karamell“. */
export function titleCase(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .map((word, i) => {
      if (KEEP_UPPER.test(word)) return word;
      const lower = word.toLocaleLowerCase("de-DE");
      if (i > 0 && LOWER_WORDS.has(lower)) return lower;
      return lower.replace(/(^|[-/(„"])(\p{L})/gu, (_, p: string, c: string) => p + c.toLocaleUpperCase("de-DE"));
    })
    .join(" ");
}
