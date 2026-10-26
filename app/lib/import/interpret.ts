/**
 * Auswertung der Texterkennung: aus Rohtexten der alten Etiketten werden
 * saubere Felder. Ohne Abhängigkeiten, damit es gut testbar ist.
 */
import { guessTeaKind, TEA_KIND_KEYS, TEA_KINDS, teaTypeLabel, type TeaKind } from "~/label/tea-types";
import { titleCase } from "~/label/text";

export interface ImportResult {
  name: string;
  /** erkannte Teeart; leer, wenn nichts passt */
  kind: TeaKind | "";
  flavored: boolean;
  /** Teeart wie gelesen bzw. als Etikett-Text */
  teaType: string;
  description: string;
  ingredients: string;
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

/** Schreibweisen der Teearten auf alten Etiketten (OCR verliert gern Umlaut-Punkte). */
const KIND_SPELLINGS: [TeaKind, string][] = [
  ...TEA_KIND_KEYS.map((k) => [k, TEA_KINDS[k].name] as [TeaKind, string]),
  ["gruen", "Grüner Tee"],
  ["schwarz", "Schwarzer Tee"],
  ["rooibos", "Rooibos"],
  ["rooibos", "Rooibos Tee"],
  ["fruechte", "Früchte Tee"],
  ["kraeuter", "Kräuter Tee"],
];

/**
 * Teeart mit den fünf Arten abgleichen, auch zweizeilig („AROMATISIERTER /
 * GRÜNER TEE“) und mit Lesefehlern.
 */
export function matchTeaKind(raw: string): { kind: TeaKind | ""; flavored: boolean; teaType: string; confidence: number } {
  const text = cleanLine(raw.replace(/\s*\n\s*/g, " "));
  if (!text) return { kind: "", flavored: false, teaType: "", confidence: 0 };
  const words = fold(text).split(" ");
  const flavored = words.some((w) => similarity(w, "aromatisierter") >= 0.7);
  const rest = words.filter((w) => similarity(w, "aromatisierter") < 0.7).join(" ");
  const direct = guessTeaKind(fold(text));
  if (direct) return { kind: direct.kind, flavored, teaType: teaTypeLabel(direct.kind, flavored), confidence: 95 };
  let best = { kind: "" as TeaKind | "", sim: 0 };
  for (const [kind, name] of KIND_SPELLINGS) {
    const sim = similarity(rest, name);
    if (sim > best.sim) best = { kind, sim };
  }
  if (best.kind && best.sim >= 0.7) return { kind: best.kind, flavored, teaType: teaTypeLabel(best.kind, flavored), confidence: Math.round(best.sim * 100) };
  return { kind: "", flavored, teaType: titleCase(text), confidence: 30 };
}

/**
 * Teeart und Beschreibung aus einem gemeinsam gelesenen Block trennen: Die
 * Teeart steht in Großbuchstaben über der Beschreibung (höchstens zwei
 * Zeilen), die Beschreibung in normaler Schreibweise.
 */
export function splitTypeFromBlock(block: string): { type: string; rest: string } {
  const lines = block.replace(/\r/g, "").split("\n");
  const type: string[] = [];
  let i = 0;
  // Störzeilen vom Zierrahmen darüber („7 NE SC o0wI wi“): kurze Wortfetzen, Ziffern, Zeichen
  const isNoise = (line: string) => {
    const words = line.trim().split(/\s+/).filter(Boolean);
    const letters = line.replace(/[^\p{L}]/gu, "").length;
    const avg = words.length ? letters / words.length : 0;
    return letters > 0 && (avg < 3 || letters / line.replace(/\s/g, "").length < 0.7);
  };
  while (i < Math.min(lines.length, 3) && isNoise(lines[i]!)) i++;
  const start = i;
  for (; i < lines.length; i++) {
    const line = lines[i]!.trim();
    const letters = line.replace(/[^\p{L}]/gu, "");
    if (!letters) {
      // Leerzeilen und Trennlinien vor oder zwischen der Teeart überspringen
      if (type.length === 0 || i + 1 < lines.length) continue;
      break;
    }
    const upper = letters.replace(/[^\p{Lu}]/gu, "").length / letters.length;
    if (upper < 0.8 || letters.length < 3 || type.length === 2) break;
    type.push(line);
  }
  return { type: type.join("\n"), rest: lines.slice(type.length ? i : start).join("\n").trim() };
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
