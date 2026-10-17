import { encode } from "uqr";

/** Prüfziffer für EAN-8/EAN-13 (Gewichte 3/1 von rechts). */
function checkDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const d = Number(digits[digits.length - 1 - i]);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Normalisiert eine EAN: Leerzeichen entfernen, bei 12 bzw. 7 Ziffern die
 * Prüfziffer ergänzen. Gibt null zurück, wenn die Nummer ungültig ist.
 */
export function normalizeEan(input: string): string | null {
  const s = input.replace(/[\s-]/g, "");
  if (s === "") return "";
  if (!/^\d+$/.test(s)) return null;
  if (s.length === 12 || s.length === 7) return s + checkDigit(s);
  if (s.length === 13 || s.length === 8) return checkDigit(s.slice(0, -1)) === Number(s.at(-1)) ? s : null;
  return null;
}

// Zeichensätze nach GS1: L (ungerade Parität), G (gerade), R (rechte Hälfte)
const L_CODES = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const invert = (c: string) => c.replace(/[01]/g, (b) => (b === "1" ? "0" : "1"));
const R_CODES = L_CODES.map(invert);
const G_CODES = R_CODES.map((c) => [...c].reverse().join(""));
/** Parität der linken Hälfte bei EAN-13, bestimmt durch die erste Ziffer */
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

/**
 * Module (1 = Strich) eines EAN-13 bzw. EAN-8: je 7 pro Ziffer plus Rand-
 * und Mittelzeichen, insgesamt 95 bzw. 67 Module.
 */
export function eanModules(ean: string): string {
  const d = [...ean].map(Number);
  const isEan8 = ean.length === 8;
  const left = isEan8 ? d.slice(0, 4) : d.slice(1, 7);
  const right = isEan8 ? d.slice(4) : d.slice(7);
  const parity = isEan8 ? "LLLL" : PARITY[d[0]!]!;
  return "101" + left.map((n, i) => (parity[i] === "G" ? G_CODES[n] : L_CODES[n])).join("") + "01010" + right.map((n) => R_CODES[n]).join("") + "101";
}

const cache = new Map<string, string>();

function memo(key: string, make: () => string): string {
  let v = cache.get(key);
  if (v === undefined) {
    try {
      v = make();
    } catch {
      v = "";
    }
    if (cache.size > 500) cache.clear();
    cache.set(key, v);
  }
  return v;
}

/** EAN-Strichcode mit Klarschrift als SVG (skaliert über viewBox). */
export function barcodeSvg(ean: string): string {
  return memo(`b:${ean}`, () => {
    if (!/^(\d{8}|\d{13})$/.test(ean)) return "";
    const modules = eanModules(ean);
    const half = ean.length === 8 ? 4 : 6;
    // Rand- und Mittelzeichen ragen in die Klarschrift hinein
    const isGuard = (i: number) => i < 3 || (i >= 3 + 7 * half && i < 8 + 7 * half) || i >= modules.length - 3;
    let path = "";
    for (let i = 0; i < modules.length; ) {
      if (modules[i] !== "1") {
        i++;
        continue;
      }
      let w = 1;
      while (modules[i + w] === "1" && isGuard(i + w) === isGuard(i)) w++;
      path += `M${i} 0h${w}v${isGuard(i) ? 35 : 31}h-${w}z`;
      i += w;
    }
    const digits = [...ean];
    const text: [string, number][] = half === 6 ? [[digits.shift()!, -4]] : [];
    digits.forEach((c, i) => text.push([c, (i < half ? 3 : 8) + 7 * i + 3.5]));
    const minX = half === 6 ? -8 : -2;
    return (
      `<svg viewBox="${minX} 0 ${modules.length + 2 - minX} 40" xmlns="http://www.w3.org/2000/svg">` +
      `<path fill="#000" d="${path}"/>` +
      `<g font-family="Oswald, sans-serif" font-size="8.5" text-anchor="middle" fill="#000">` +
      text.map(([c, x]) => `<text x="${x}" y="39">${c}</text>`).join("") +
      `</g></svg>`
    );
  });
}

/** QR-Code als SVG, ohne Ruhezone (die liefert der Etikettrand). */
export function qrSvg(url: string): string {
  return memo(`q:${url}`, () => {
    const { size, data } = encode(url, { ecc: "M", border: 0 });
    let path = "";
    data.forEach((row, y) => {
      for (let x = 0; x < size; ) {
        if (!row[x]) {
          x++;
          continue;
        }
        let w = 1;
        while (row[x + w]) w++;
        path += `M${x} ${y}h${w}v1h-${w}z`;
        x += w;
      }
    });
    return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><path fill="#000" d="${path}"/></svg>`;
  });
}
