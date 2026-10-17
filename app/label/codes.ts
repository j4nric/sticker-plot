import { toSVG } from "bwip-js";

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

/** EAN-Strichcode als SVG (skaliert über viewBox). */
export function barcodeSvg(ean: string): string {
  const bcid = ean.length === 8 ? "ean8" : "ean13";
  return memo(`b:${ean}`, () => toSVG({ bcid, text: ean, includetext: true, textxalign: "center", height: 8, scale: 1 }));
}

/** QR-Code als SVG. */
export function qrSvg(url: string): string {
  return memo(`q:${url}`, () => toSVG({ bcid: "qrcode", text: url, eclevel: "M", scale: 1 }));
}
