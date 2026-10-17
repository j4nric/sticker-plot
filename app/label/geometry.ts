/**
 * Geometrie des Etikettenbogens und Druckerkalibrierung.
 *
 * Alle Maße in Millimetern. Das Standardformat stammt aus dem bisherigen
 * Photoshop-PDF (A4 quer, 6 Spalten x 2 Zeilen, Hochformat-Etiketten).
 * Weitere Formate werden in der Verwaltung angelegt.
 */

export interface SheetGeometry {
  pageWidth: number;
  pageHeight: number;
  columns: number;
  rows: number;
  labelWidth: number;
  labelHeight: number;
  /** linke obere Ecke des ersten Etiketts */
  originX: number;
  originY: number;
  /** Abstand von Etikett zu Etikett (Raster), nicht die Lücke */
  pitchX: number;
  pitchY: number;
}

/** Anzahl Etiketten und erstes freies Feld eines Druckauftrags. */
export interface PrintLayout {
  count: number;
  start: number;
}

/** Höchstzahl Etiketten je Druckauftrag (Formular und Server). */
export const MAX_PRINT_LABELS = 600;

/** Felder eines Bogenformats in der Reihenfolge des Formulars. */
export const GEOMETRY_FIELDS = ["pageWidth", "pageHeight", "columns", "rows", "labelWidth", "labelHeight", "originX", "originY", "pitchX", "pitchY"] as const;

export const DEFAULT_SHEET: SheetGeometry = {
  pageWidth: 297,
  pageHeight: 210,
  columns: 6,
  rows: 2,
  labelWidth: 45.5,
  labelHeight: 95.3,
  originX: 0.5,
  originY: 6.3,
  pitchX: 50,
  pitchY: 103.1,
};

export const labelsPerSheet = (g: SheetGeometry) => g.columns * g.rows;

export interface Point {
  x: number;
  y: number;
}

/** Position der linken oberen Ecke eines Etiketts, Index zeilenweise ab 0. */
export function slotPosition(index: number, g: SheetGeometry = DEFAULT_SHEET): Point {
  const col = index % g.columns;
  const row = Math.floor(index / g.columns);
  return { x: round(g.originX + col * g.pitchX, 3), y: round(g.originY + row * g.pitchY, 3) };
}

/** Prüft, ob alle Etiketten auf die Seite passen und sich nicht überlappen. */
export function validateGeometry(g: SheetGeometry): string[] {
  const errors: string[] = [];
  const pos = (n: number) => Number.isFinite(n) && n > 0;
  if (!pos(g.pageWidth) || !pos(g.pageHeight)) errors.push("Seitengröße muss größer als 0 sein.");
  if (!Number.isInteger(g.columns) || g.columns < 1 || g.columns > 20) errors.push("Spalten: 1 bis 20.");
  if (!Number.isInteger(g.rows) || g.rows < 1 || g.rows > 40) errors.push("Zeilen: 1 bis 40.");
  if (!pos(g.labelWidth) || !pos(g.labelHeight)) errors.push("Etikettgröße muss größer als 0 sein.");
  if (g.labelWidth < 15 || g.labelHeight < 15) errors.push("Etiketten kleiner als 15 mm werden nicht unterstützt.");
  if (g.originX < 0 || g.originY < 0) errors.push("Ursprung darf nicht negativ sein.");
  if (g.columns > 1 && g.pitchX < g.labelWidth) errors.push("Abstand waagerecht ist kleiner als die Etikettbreite (Überlappung).");
  if (g.rows > 1 && g.pitchY < g.labelHeight) errors.push("Abstand senkrecht ist kleiner als die Etiketthöhe (Überlappung).");
  if (errors.length) return errors;
  const last = slotPosition(labelsPerSheet(g) - 1, g);
  if (last.x + g.labelWidth > g.pageWidth + 0.01) errors.push("Die letzte Spalte ragt über den rechten Seitenrand.");
  if (last.y + g.labelHeight > g.pageHeight + 0.01) errors.push("Die letzte Zeile ragt über den unteren Seitenrand.");
  return errors;
}

/**
 * Referenzpunkte für die Kalibrierung: obere linke Ecke von Etikett 2 (bzw. 1
 * bei nur einer Spalte) und obere linke Ecke des letzten Etiketts.
 */
export function referencePoints(g: SheetGeometry = DEFAULT_SHEET): { a: Point; b: Point; aIndex: number; bIndex: number } {
  const aIndex = g.columns > 1 ? 1 : 0;
  const bIndex = labelsPerSheet(g) - 1;
  return { a: slotPosition(aIndex, g), b: slotPosition(bIndex, g), aIndex, bIndex };
}

export interface Calibration {
  /** Verschiebung in mm, + = nach rechts bzw. unten */
  offsetX: number;
  offsetY: number;
  /** Skalierung, 1 = 100 % */
  scaleX: number;
  scaleY: number;
}

export const NO_CALIBRATION: Calibration = { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 };

export const CALIBRATION_LIMITS = {
  offset: 15,
  scaleMin: 0.9,
  scaleMax: 1.1,
} as const;

/**
 * Abweichung, die am Testbogen abgelesen wurde: Wo liegt die Kreuzmitte
 * relativ zur echten Etikettecke? + = Kreuz liegt rechts bzw. unterhalb.
 */
export interface MeasuredDeviation {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
function round(v: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/**
 * Neue Kalibrierung aus der bisherigen und der gemessenen Restabweichung.
 *
 * Die Transformation skaliert um Punkt A. Deshalb wirkt die Verschiebung
 * direkt auf A, und die Skalierung ergibt sich aus dem gemessenen Abstand A-B.
 */
export function applyMeasurement(current: Calibration, m: MeasuredDeviation, g: SheetGeometry = DEFAULT_SHEET): Calibration {
  const { a, b } = referencePoints(g);
  const spanX = b.x - a.x;
  const spanY = b.y - a.y;
  const L = CALIBRATION_LIMITS;
  const scale = (cur: number, span: number, delta: number) =>
    span > 1 ? round(clamp((cur * span) / (span + delta), L.scaleMin, L.scaleMax), 5) : cur;
  return {
    offsetX: round(clamp(current.offsetX - m.ax, -L.offset, L.offset), 2),
    offsetY: round(clamp(current.offsetY - m.ay, -L.offset, L.offset), 2),
    scaleX: scale(current.scaleX, spanX, m.bx - m.ax),
    scaleY: scale(current.scaleY, spanY, m.by - m.ay),
  };
}

/** CSS-Transformation für den Bogen-Container. */
export function calibrationStyle(c: Calibration, g: SheetGeometry = DEFAULT_SHEET): { transformOrigin: string; transform: string } {
  const { a } = referencePoints(g);
  return {
    transformOrigin: `${a.x}mm ${a.y}mm`,
    transform: `translate(${c.offsetX}mm, ${c.offsetY}mm) scale(${c.scaleX}, ${c.scaleY})`,
  };
}

/**
 * Verteilt `count` Etiketten ab Position `start` (1-basiert) auf Bögen.
 * Ergebnis: pro Bogen ein Array mit einem Eintrag je Feld, true = drucken.
 */
export function layoutPages(count: number, start: number, perSheet: number): boolean[][] {
  return layoutSequence(Array(Math.max(0, Math.floor(count))).fill(true), start, perSheet).map((p) => p.map((v) => v !== null));
}

/**
 * Verteilt eine Folge beliebiger Einträge (z. B. verschiedene Tees) ab
 * Position `start` auf Bögen. Freie Felder sind null.
 */
export function layoutSequence<T>(items: T[], start: number, perSheet: number): (T | null)[][] {
  const first = clamp(Math.floor(start), 1, perSheet) - 1;
  const total = first + items.length;
  const pageCount = Math.max(1, Math.ceil(total / perSheet));
  const pages: (T | null)[][] = [];
  for (let p = 0; p < pageCount; p++) {
    const slots: (T | null)[] = [];
    for (let i = 0; i < perSheet; i++) {
      const global = p * perSheet + i;
      slots.push(global >= first && global < total ? items[global - first]! : null);
    }
    pages.push(slots);
  }
  return pages;
}

/** Erstes freies Feld nach einem Druck (1-basiert); ein voller Bogen beginnt wieder bei 1. */
export function nextFreeSlot(start: number, count: number, perSheet: number): number {
  const used = (clamp(Math.floor(start), 1, perSheet) - 1 + Math.max(0, count)) % perSheet;
  return used + 1;
}

/**
 * Das Etikett-Design ist für 45,5 x 95,3 mm entworfen. Andere Größen werden
 * gleichmäßig skaliert; die Innenfläche wird dabei in der freien Richtung
 * gestreckt, damit das Etikett exakt das Feld füllt.
 */
export const DESIGN_SIZE = { width: 45.5, height: 95.3 } as const;

export function labelBox(g: Pick<SheetGeometry, "labelWidth" | "labelHeight">) {
  const scale = Math.min(g.labelWidth / DESIGN_SIZE.width, g.labelHeight / DESIGN_SIZE.height);
  return {
    scale: round(scale, 5),
    innerWidth: round(g.labelWidth / scale, 3),
    innerHeight: round(g.labelHeight / scale, 3),
  };
}
