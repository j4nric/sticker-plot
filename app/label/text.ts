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
    .map((part) => (/^(\s+|https?:\/\/\S+|www\.\S+)$/.test(part) || part === "" ? part : hyphenateWord(part, minWordLength)))
    .join("");
}

// Wörter wiederholen sich (Bogen mit vielen gleichen Etiketten, Tippen in der
// Vorschau, Sammeldruck), daher je Wort zwischenspeichern
const wordCache = new Map<string, string>();

function hyphenateWord(word: string, minWordLength: number): string {
  const key = `${minWordLength}|${word}`;
  let v = wordCache.get(key);
  if (v === undefined) {
    v = hyphenateSync(word, { minWordLength });
    if (wordCache.size >= 5000) wordCache.clear();
    wordCache.set(key, v);
  }
  return v;
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

const isSpace = (c: string) => /\s/.test(c);
const isPunct = (c: string) => /[\p{P}\p{S}]/u.test(c);

/**
 * Zerlegt Text mit Formatierungszeichen in Abschnitte.
 *
 * Wie bei Markdown öffnet ein Zeichen nur, wenn danach Text beginnt, und
 * schließt nur, wenn davor Text endet (Flanken-Regel aus CommonMark). Ein
 * Fußnotenstern wie in „Grüner Tee*, Hibiskus*“ bleibt deshalb stehen,
 * „*Mandel*stücke“ wird dagegen fett. Zeichen ohne passendes Gegenstück
 * bleiben ebenfalls als normaler Text stehen.
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
  const toggles = new Map<number, Style>();
  for (const style of Object.keys(found) as Style[]) {
    const len = MARKUP[style].length;
    let open: number | null = null;
    for (const pos of found[style]) {
      const before = text[pos - 1] ?? " ";
      const after = text[pos + len] ?? " ";
      const canOpen = !isSpace(after) && (!isPunct(after) || isSpace(before) || isPunct(before));
      const canClose = !isSpace(before) && (!isPunct(before) || isSpace(after) || isPunct(after));
      if (open !== null && canClose && text.slice(open + len, pos).trim()) {
        toggles.set(open, style);
        toggles.set(pos, style);
        open = null;
      } else if (canOpen) {
        open = pos;
      }
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
