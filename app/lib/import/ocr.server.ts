/**
 * Texterkennung für alte Photoshop-Etiketten.
 *
 * Ablauf: PDF-Seite mit pdf.js rastern (300 dpi), das erste Etikett anhand
 * des bekannten Rasters ausschneiden, Titel, Teeart und Beschreibung in
 * getrennten Bereichen vergrößert und in Schwarz-Weiß erkennen (tesseract.js,
 * deutsches Sprachmodell, läuft ohne Internet), Tassenfarbe aus den Pixeln
 * bestimmen.
 */
import { createCanvas, type Canvas } from "@napi-rs/canvas";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createWorker, PSM, type Worker } from "tesseract.js";
import { toHex } from "~/label/color";
import { chooseTitle, matchTeaType, nameFromFileName, snapColor, splitDescription, type ImportResult } from "./interpret";
import { DEFAULT_TEA_COLOR } from "~/label/tea-types";

const DPI = 300;
const mmToPx = (mm: number) => Math.round((mm / 25.4) * DPI);

/**
 * Lage der Bereiche im alten Etikett (Anteile von Breite/Höhe des Etiketts),
 * gemessen an „CHINA_SENCHA_new.pdf“.
 */
const OLD_LAYOUT = {
  label: { x: 0.5, y: 6.3, w: 45.5, h: 95.3 },
  cup: [0.1, 0.05, 0.9, 0.33],
  titleTight: [0.2, 0.455, 0.8, 0.522],
  titleWide: [0.18, 0.445, 0.82, 0.53],
  type: [0.12, 0.585, 0.88, 0.65],
  description: [0.08, 0.66, 0.92, 0.892],
} as const;

type Box = readonly [number, number, number, number];

async function renderFirstPage(pdf: Buffer): Promise<{ canvas: Canvas; widthMm: number; heightMm: number; pages: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: false, verbosity: 0 });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: DPI / 72 });
    const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // pdf.js erwartet einen Canvas-ähnlichen Kontext; @napi-rs/canvas ist kompatibel
    await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise;
    return { canvas, widthMm: (base.width / 72) * 25.4, heightMm: (base.height / 72) * 25.4, pages: doc.numPages };
  } finally {
    await task.destroy();
  }
}

function crop(src: Canvas, x: number, y: number, w: number, h: number): Canvas {
  const c = createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  c.getContext("2d").drawImage(src, Math.round(x), Math.round(y), Math.round(w), Math.round(h), 0, 0, c.width, c.height);
  return c;
}

/** Bereich ausschneiden, vergrößern und binarisieren (verbessert die Erkennung deutlich). */
function band(label: Canvas, [x0, y0, x1, y1]: Box, scale = 2, threshold = 150): Buffer {
  const W = label.width;
  const H = label.height;
  const w = Math.round((x1 - x0) * W * scale);
  const h = Math.round((y1 - y0) * H * scale);
  const c = createCanvas(w + 40, h + 40);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(label, x0 * W, y0 * H, (x1 - x0) * W, (y1 - y0) * H, 20, 20, w, h);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
    const v = l < threshold ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c.toBuffer("image/png");
}

/** Mittlere Farbe der kräftigen Pixel im Bereich (Tasse). */
function dominantColor(label: Canvas, [x0, y0, x1, y1]: Box): string | null {
  const ctx = label.getContext("2d");
  const d = ctx.getImageData(Math.round(x0 * label.width), Math.round(y0 * label.height), Math.round((x1 - x0) * label.width), Math.round((y1 - y0) * label.height)).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const R = d[i]!;
    const G = d[i + 1]!;
    const B = d[i + 2]!;
    const mx = Math.max(R, G, B);
    const mn = Math.min(R, G, B);
    if (mx > 60 && mx - mn > 0.35 * mx) {
      r += R;
      g += G;
      b += B;
      n++;
    }
  }
  return n > 500 ? toHex([r / n, g / n, b / n]) : null;
}

// ---------------------------------------------------------------- Tesseract-Worker

const require = createRequire(import.meta.url);
let workerPromise: Promise<Worker> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function langPath(): string {
  return join(dirname(require.resolve("@tesseract.js-data/deu/package.json")), "4.0.0_best_int");
}

async function worker(): Promise<Worker> {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => void stopOcr(), 60_000);
  idleTimer.unref?.();
  workerPromise ??= createWorker("deu", 1, { langPath: langPath(), gzip: true, cacheMethod: "none" }).catch((e) => {
    workerPromise = null;
    throw e;
  });
  return workerPromise;
}

export async function stopOcr() {
  const p = workerPromise;
  workerPromise = null;
  if (p) await (await p).terminate().catch(() => {});
}

async function recognize(image: Buffer, psm: PSM): Promise<{ text: string; confidence: number }> {
  const w = await worker();
  await w.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: "1", user_defined_dpi: "600" });
  const r = await w.recognize(image);
  return { text: r.data.text.trim(), confidence: Math.round(r.data.confidence) };
}

// ---------------------------------------------------------------- Auswertung

export interface Extraction {
  result: ImportResult;
  /** Vorschaubild des erkannten Etiketts (PNG) */
  preview: Buffer;
}

export async function extractFromPdf(pdf: Buffer, fileName: string): Promise<Extraction> {
  const { canvas, widthMm, heightMm, pages } = await renderFirstPage(pdf);
  const warnings: string[] = [];
  if (pages > 1) warnings.push(`PDF hat ${pages} Seiten, nur die erste wird gelesen`);

  const isOldSheet = Math.abs(widthMm - 297) < 4 && Math.abs(heightMm - 210) < 4;
  const L = OLD_LAYOUT.label;
  const label = isOldSheet
    ? crop(canvas, mmToPx(L.x), mmToPx(L.y), mmToPx(L.w), mmToPx(L.h))
    : // Unbekanntes Format: die ganze Seite als ein Etikett behandeln
      canvas;
  if (!isOldSheet) warnings.push(`Unbekanntes Seitenformat (${Math.round(widthMm)} × ${Math.round(heightMm)} mm), Erkennung ungenau`);

  const fileNameGuess = nameFromFileName(fileName);
  // Drei unabhängige Läufe für den Titel (dekorative Schrift): die Mehrheit gewinnt
  const [tight, wide, sharp, typeRaw, descRaw] = [
    await recognize(band(label, OLD_LAYOUT.titleTight), PSM.SINGLE_LINE),
    await recognize(band(label, OLD_LAYOUT.titleWide), PSM.SPARSE_TEXT),
    await recognize(band(label, OLD_LAYOUT.titleTight, 3, 120), PSM.SINGLE_LINE),
    await recognize(band(label, OLD_LAYOUT.type), PSM.SINGLE_LINE),
    await recognize(band(label, OLD_LAYOUT.description), PSM.SINGLE_BLOCK),
  ];

  const title = chooseTitle([tight, wide, sharp], fileNameGuess);
  if (title.warning) warnings.push(title.warning);
  const type = matchTeaType(typeRaw.text);
  if (!type.teaType) warnings.push("Keine Teeart erkannt");
  const { description, ingredients } = splitDescription(descRaw.text);
  if (!description) warnings.push("Keine Beschreibung erkannt");
  if (descRaw.confidence < 75 && description) warnings.push("Beschreibung unsicher erkannt, bitte prüfen");

  const raw = dominantColor(label, OLD_LAYOUT.cup);
  const color = raw ? snapColor(raw) : DEFAULT_TEA_COLOR;
  if (!raw) warnings.push("Keine Tassenfarbe gefunden, Standardfarbe gesetzt");

  // Vorschau: Etikett auf ca. 360 px Breite verkleinert
  const pw = 360;
  const ph = Math.round((label.height / label.width) * pw);
  const thumb = createCanvas(pw, ph);
  thumb.getContext("2d").drawImage(label, 0, 0, pw, ph);

  return {
    result: {
      name: title.name,
      teaType: type.teaType,
      description,
      ingredients,
      color,
      confidence: { name: title.confidence, teaType: type.confidence, description: descRaw.confidence },
      warnings,
      fileNameGuess,
    },
    preview: thumb.toBuffer("image/png"),
  };
}
