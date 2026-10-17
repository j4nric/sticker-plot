import { describe, expect, it } from "vitest";
import { applyMeasurement, calibrationStyle, layoutPages, NO_CALIBRATION, referencePoints, SHEET, slotPosition } from "./geometry";

describe("slotPosition", () => {
  it("berechnet das 6x2-Raster aus dem Original-PDF", () => {
    expect(slotPosition(0)).toEqual({ x: 0.5, y: 6.3 });
    expect(slotPosition(5)).toEqual({ x: 250.5, y: 6.3 });
    expect(slotPosition(6).y).toBeCloseTo(109.4);
    const last = slotPosition(11);
    expect(last.x + SHEET.labelWidth).toBeLessThanOrEqual(SHEET.pageWidth);
    expect(last.y + SHEET.labelHeight).toBeLessThanOrEqual(SHEET.pageHeight);
  });
});

describe("layoutPages", () => {
  it("füllt einen ganzen Bogen", () => {
    expect(layoutPages(12, 1)).toEqual([Array(12).fill(true)]);
  });
  it("beginnt auf angebrochenen Bögen beim ersten freien Feld", () => {
    const [page] = layoutPages(3, 5);
    expect(page!.map((f, i) => (f ? i + 1 : 0)).filter(Boolean)).toEqual([5, 6, 7]);
  });
  it("verteilt auf mehrere Bögen und beginnt ab Bogen 2 bei Feld 1", () => {
    const pages = layoutPages(10, 7);
    expect(pages).toHaveLength(2);
    expect(pages[0]!.filter(Boolean)).toHaveLength(6);
    expect(pages[1]!.slice(0, 4).every(Boolean)).toBe(true);
    expect(pages[1]!.slice(4).some(Boolean)).toBe(false);
  });
  it("begrenzt ungültige Startwerte", () => {
    expect(layoutPages(1, 99)[0]![11]).toBe(true);
    expect(layoutPages(1, 0)[0]![0]).toBe(true);
  });
});

describe("applyMeasurement", () => {
  it("verschiebt entgegen der gemessenen Abweichung", () => {
    const c = applyMeasurement(NO_CALIBRATION, { ax: 2, ay: -1.5, bx: 2, by: -1.5 });
    expect(c.offsetX).toBe(-2);
    expect(c.offsetY).toBe(1.5);
    expect(c.scaleX).toBe(1);
    expect(c.scaleY).toBe(1);
  });
  it("korrigiert die Skalierung aus dem Abstand A-B", () => {
    const { a, b } = referencePoints();
    // Drucker druckt 1 % zu groß: B liegt um 1 % des Abstands weiter weg
    const dx = (b.x - a.x) * 0.01;
    const dy = (b.y - a.y) * 0.01;
    const c = applyMeasurement(NO_CALIBRATION, { ax: 0, ay: 0, bx: dx, by: dy });
    expect(c.scaleX).toBeCloseTo(1 / 1.01, 4);
    expect(c.scaleY).toBeCloseTo(1 / 1.01, 4);
  });
  it("addiert sich mit einer bestehenden Korrektur", () => {
    const first = applyMeasurement(NO_CALIBRATION, { ax: 1, ay: 1, bx: 1, by: 1 });
    const second = applyMeasurement(first, { ax: 0.5, ay: -0.2, bx: 0.5, by: -0.2 });
    expect(second.offsetX).toBe(-1.5);
    expect(second.offsetY).toBe(-0.8);
  });
  it("begrenzt unplausible Werte", () => {
    const c = applyMeasurement(NO_CALIBRATION, { ax: 100, ay: 0, bx: -100, by: 0 });
    expect(c.offsetX).toBe(-15);
    expect(c.scaleX).toBe(1.1);
  });
});

describe("calibrationStyle", () => {
  it("skaliert um Referenzpunkt A", () => {
    const s = calibrationStyle({ offsetX: 1, offsetY: -0.5, scaleX: 1.01, scaleY: 0.99 });
    expect(s.transformOrigin).toBe("50.5mm 6.3mm");
    expect(s.transform).toBe("translate(1mm, -0.5mm) scale(1.01, 0.99)");
  });
});
