/**
 * Geometrie des Etikettenbogens und Druckerkalibrierung.
 *
 * Alle Maße in Millimetern. Die Werte stammen aus dem bisherigen Photoshop-PDF
 * (A4 quer, 6 Spalten x 2 Zeilen, Hochformat-Etiketten). Kleine Abweichungen
 * zum echten Stanzbild gleicht die Kalibrierung pro Drucker aus.
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

export const SHEET: SheetGeometry = {
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

export const LABELS_PER_SHEET = SHEET.columns * SHEET.rows;

export interface Point {
  x: number;
  y: number;
}

/** Position der linken oberen Ecke eines Etiketts, Index 0..11 zeilenweise. */
export function slotPosition(index: number, g: SheetGeometry = SHEET): Point {
  const col = index % g.columns;
  const row = Math.floor(index / g.columns);
  return { x: g.originX + col * g.pitchX, y: g.originY + row * g.pitchY };
}

/**
 * Referenzpunkte für die Kalibrierung: obere linke Ecke von Etikett 2 (oben)
 * und obere linke Ecke von Etikett 12 (unten rechts). Beide liegen sicher im
 * bedruckbaren Bereich üblicher Bürodrucker.
 */
export const REF_A_INDEX = 1;
export const REF_B_INDEX = LABELS_PER_SHEET - 1;

export function referencePoints(g: SheetGeometry = SHEET): { a: Point; b: Point } {
  return { a: slotPosition(REF_A_INDEX, g), b: slotPosition(REF_B_INDEX, g) };
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
const round = (v: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

/**
 * Neue Kalibrierung aus der bisherigen und der gemessenen Restabweichung.
 *
 * Die Transformation skaliert um Punkt A. Deshalb wirkt die Verschiebung
 * direkt auf A, und die Skalierung ergibt sich aus dem gemessenen Abstand A-B.
 */
export function applyMeasurement(
  current: Calibration,
  m: MeasuredDeviation,
  g: SheetGeometry = SHEET,
): Calibration {
  const { a, b } = referencePoints(g);
  const spanX = b.x - a.x;
  const spanY = b.y - a.y;
  const L = CALIBRATION_LIMITS;
  return {
    offsetX: round(clamp(current.offsetX - m.ax, -L.offset, L.offset), 2),
    offsetY: round(clamp(current.offsetY - m.ay, -L.offset, L.offset), 2),
    scaleX: round(clamp((current.scaleX * spanX) / (spanX + m.bx - m.ax), L.scaleMin, L.scaleMax), 5),
    scaleY: round(clamp((current.scaleY * spanY) / (spanY + m.by - m.ay), L.scaleMin, L.scaleMax), 5),
  };
}

/** CSS-Transformation für den Bogen-Container. */
export function calibrationStyle(c: Calibration, g: SheetGeometry = SHEET): { transformOrigin: string; transform: string } {
  const { a } = referencePoints(g);
  return {
    transformOrigin: `${a.x}mm ${a.y}mm`,
    transform: `translate(${c.offsetX}mm, ${c.offsetY}mm) scale(${c.scaleX}, ${c.scaleY})`,
  };
}

/**
 * Verteilt `count` Etiketten ab Position `start` (1-basiert) auf Bögen.
 * Ergebnis: pro Bogen ein Array mit 12 Einträgen, true = Etikett drucken.
 */
export function layoutPages(count: number, start = 1, perSheet = LABELS_PER_SHEET): boolean[][] {
  const first = clamp(Math.floor(start), 1, perSheet) - 1;
  const n = Math.max(0, Math.floor(count));
  const total = first + n;
  const pageCount = Math.max(1, Math.ceil(total / perSheet));
  const pages: boolean[][] = [];
  for (let p = 0; p < pageCount; p++) {
    const slots: boolean[] = [];
    for (let i = 0; i < perSheet; i++) {
      const global = p * perSheet + i;
      slots.push(global >= first && global < total);
    }
    pages.push(slots);
  }
  return pages;
}
