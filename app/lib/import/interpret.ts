/**
 * Auswertung der Texterkennung: aus Rohtexten der alten Etiketten werden
 * saubere Felder. Ohne Abhängigkeiten, damit es gut testbar ist.
 */
import { colorDistance } from "~/label/color";
import { TEA_TYPES } from "~/label/tea-types";
import { titleCase } from "~/label/text";

export interface ImportResult {
  name: string;
  teaType: string;
  description: string;
  ingredients: string;
  color: string;
  /** 0–100 je Feld */
  confidence: { name: number; teaType: number; description: number };
  warnings: string[];
  fileNameGuess: string;
}

/** Für Vergleiche: Kleinbuchstaben, Umlaute ohne Punkte, nur Buchstaben/Ziffern. */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ae/g, "a")
    .replace(/oe/g, "o")
    .replace(/ue/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/** Ähnlichkeit 0–1 nach Normalisierung. */
export function similarity(a: string, b: string): number {
  const x = fold(a);
  const y = fold(b);
  if (!x && !y) return 1;
  if (!x || !y) return 0;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

const FILE_NOISE = /\b(new|neu|final|kopie|copy|etikett(en)?|label|sticker|bogen|druck|print|scan\w*|img\w*|image\w*|dokument\w*|document\w*|v\d+|\d+)\b/gi;

/** „CHINA_SENCHA_new.pdf“ → „China Sencha“. */
export function nameFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[_]+/g, " ");
  const cleaned = base.replace(FILE_NOISE, " ").replace(/\s+-\s*$/, "").replace(/\s+/g, " ").trim();
  return cleaned ? titleCase(cleaned) : "";
}

/** Erkannte Zeile säubern: Störzeichen von Rahmen und Ornamenten entfernen. */
export function cleanLine(s: string): string {
  return s
    .replace(/[|¦]/g, "I")
    .replace(/[“”„"«»]/g, "")
    .split(/\s+/)
    .filter((w) => /\p{L}{2,}|\d/u.test(w))
    .join(" ")
    .replace(/^[^\p{L}\d]+|[^\p{L}\d.!)]+$/gu, "")
    .trim();
}

/**
 * Wählt den Titel: Kandidaten aus mehreren Erkennungsläufen und dem
 * Dateinamen stimmen ab; der Kandidat mit der größten Übereinstimmung gewinnt.
 */
export function chooseTitle(ocr: { text: string; confidence: number }[], fileGuess: string): { name: string; confidence: number; warning?: string } {
  const cands = ocr.map((c) => ({ text: cleanLine(c.text), confidence: c.confidence })).filter((c) => fold(c.text).length >= 2);
  const all = [...cands, ...(fileGuess ? [{ text: fileGuess, confidence: 70 }] : [])];
  if (!all.length) return { name: "", confidence: 0, warning: "Kein Name erkannt" };
  let best = all[0]!;
  let bestScore = -1;
  for (const c of all) {
    const score = all.reduce((s, o) => s + (o === c ? 0 : similarity(c.text, o.text)), 0) + c.confidence / 1000;
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  const agree = all.length > 1 ? bestScore / (all.length - 1) : 0.5;
  const confidence = Math.round(Math.min(100, agree * 100));
  const name = titleCase(best.text);
  return { name, confidence, warning: confidence < 70 ? "Name unsicher erkannt, bitte prüfen" : undefined };
}

/** Teeart mit der Liste bekannter Arten abgleichen (OCR verliert gern Umlaut-Punkte). */
export function matchTeaType(raw: string): { teaType: string; confidence: number } {
  const text = cleanLine(raw);
  if (!text) return { teaType: "", confidence: 0 };
  let best = { name: "", sim: 0 };
  for (const t of TEA_TYPES) {
    const sim = similarity(text, t.name);
    if (sim > best.sim) best = { name: t.name, sim };
  }
  if (best.sim >= 0.75) return { teaType: best.name, confidence: Math.round(best.sim * 100) };
  return { teaType: titleCase(text), confidence: 50 };
}

/** Zeilen zu Fließtext: Trennstriche am Zeilenende auflösen, Leerzeilen als Absatz. */
export function joinLines(text: string): string {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.trim());
  let out = "";
  for (const line of lines) {
    if (!line) {
      if (out && !out.endsWith("\n\n")) out = out.trimEnd() + "\n\n";
      continue;
    }
    const clean = line.replace(/^[^\p{L}\d„"(]+/u, "").replace(/\s{2,}/g, " ");
    if (!clean) continue;
    if (!out || out.endsWith("\n")) out += clean;
    else if (/\p{Ll}-$/u.test(out) && /^\p{Ll}/u.test(clean)) out = out.slice(0, -1) + clean;
    else out += " " + clean;
  }
  return out.trim();
}

/** Beschreibung säubern und eine enthaltene Zutatenliste abtrennen. */
export function splitDescription(raw: string): { description: string; ingredients: string } {
  const text = joinLines(raw)
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[«»]/g, "")
    .trim();
  const m = text.match(/\bZutaten\s*:\s*([\s\S]+)$/i);
  if (!m) return { description: text, ingredients: "" };
  return { description: text.slice(0, m.index).trim(), ingredients: m[1]!.trim() };
}

/** Erkannte Tassenfarbe: nahe an einer Standardfarbe → diese verwenden. */
export function snapColor(hex: string): string {
  let best = { color: hex, d: Infinity };
  for (const t of TEA_TYPES) {
    const d = colorDistance(hex, t.color);
    if (d < best.d) best = { color: t.color, d };
  }
  return best.d < 90 ? best.color : hex.toLowerCase();
}
