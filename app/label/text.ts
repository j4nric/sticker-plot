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

/** Einfache Hervorhebung: *Mandeln* wird fett (für Allergene in den Zutaten). */
export function parseEmphasis(text: string): { text: string; bold: boolean }[] {
  const parts: { text: string; bold: boolean }[] = [];
  const re = /\*([^*\n]+)\*/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), bold: false });
    parts.push({ text: m[1]!, bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), bold: false });
  return parts;
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
