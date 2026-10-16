/** Farbhilfen für lesbare Etiketten (ohne Abhängigkeiten, läuft im Browser und auf dem Server). */

export function isHexColor(v: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(v);
}

function parse(hex: string): [number, number, number] {
  const h = isHexColor(hex) ? hex.slice(1) : "777777";
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function toHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Kontrastverhältnis zweier Farben nach WCAG. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(parse(a));
  const lb = luminance(parse(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Dunkelt eine Farbe so weit ab, bis sie auf Weiß gut lesbar ist (Standard 4,5:1).
 * Für Schrift und feine Linien; Flächen behalten die Originalfarbe.
 */
export function inkColor(hex: string, minContrast = 4.5): string {
  const base = parse(hex);
  for (let k = 0; k <= 1.0001; k += 0.04) {
    const mixed = base.map((c) => c * (1 - k)) as [number, number, number];
    const out = toHex(mixed);
    if (contrastRatio(out, "#ffffff") >= minContrast) return out;
  }
  return "#000000";
}

/** Abstand zweier Farben (einfaches gewichtetes RGB-Maß). */
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const rm = (r1 + r2) / 2;
  return Math.sqrt((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2);
}

/**
 * Flächenfarbe für Motiv und Linien: sehr helle Farben (z. B. Hellgelb)
 * würden auf weißem Papier verschwinden und werden leicht abgedunkelt.
 */
export function fillColor(hex: string, minContrast = 1.9): string {
  return contrastRatio(hex, "#ffffff") >= minContrast ? hex.toLowerCase() : inkColor(hex, minContrast);
}
