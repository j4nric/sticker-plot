import { describe, expect, it } from "vitest";
import { normalizeEan } from "./codes";
import { contrastRatio, fillColor, inkColor } from "./color";
import { DEFAULT_SHEET, labelBox, layoutSequence, nextFreeSlot, referencePoints, validateGeometry } from "./geometry";
import { resolveMotif } from "./motifs";
import { normalizeParams } from "./template";
import { hyphenate, normalizeParagraphs, parseEmphasis, titleCase, unsupportedChars } from "./text";

describe("Text", () => {
  it("setzt weiche Trennstriche nach deutschen Regeln, nicht in Adressen", () => {
    expect(hyphenate("Rotbuschteespezialmischung")).toBe("Rot­busch­tee­spe­zi­al­mi­schung");
    expect(hyphenate("www.teetreffpunkt.de")).toBe("www.teetreffpunkt.de");
    expect(hyphenate("Tee mit Minze")).toBe("Tee mit Minze");
  });
  it("normalisiert Absätze", () => {
    expect(normalizeParagraphs("  Zeile 1 \r\n\r\n\r\n\r\n  Zeile   2 ")).toBe("Zeile 1\n\nZeile 2");
  });
  it("erkennt *Hervorhebungen*", () => {
    expect(parseEmphasis("Tee, *Mandeln*, Aroma")).toEqual([
      { text: "Tee, ", bold: false },
      { text: "Mandeln", bold: true },
      { text: ", Aroma", bold: false },
    ]);
  });
  it("findet nicht druckbare Zeichen", () => {
    expect(unsupportedChars("Čaj ő Łódź – „Tee“ 80 °C ½ € …")).toEqual([]);
    expect(unsupportedChars("Tee 🍵 龍井")).toEqual(["🍵", "龍", "井"]);
  });
  it("wandelt Großbuchstaben in Titelschreibweise", () => {
    expect(titleCase("CHINA SENCHA")).toBe("China Sencha");
    expect(titleCase("ASSAM TGFOP MIT MALZ")).toBe("Assam TGFOP mit Malz");
    expect(titleCase("ROOIBOS VANILLE-KARAMELL")).toBe("Rooibos Vanille-Karamell");
  });
});

describe("EAN", () => {
  it("prüft und ergänzt die Prüfziffer", () => {
    expect(normalizeEan("4006381333931")).toBe("4006381333931");
    expect(normalizeEan("400638133393")).toBe("4006381333931");
    expect(normalizeEan("4006381333932")).toBeNull();
    expect(normalizeEan("9638-5074")).toBe("96385074");
    expect(normalizeEan("")).toBe("");
    expect(normalizeEan("abc")).toBeNull();
  });
});

describe("Farben", () => {
  it("dunkelt helle Farben für Schrift ab", () => {
    expect(contrastRatio(inkColor("#f5f0a0"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(inkColor("#1a1a1a")).toBe("#1a1a1a");
    expect(contrastRatio(fillColor("#f5f0a0"), "#ffffff")).toBeGreaterThanOrEqual(1.9);
    expect(fillColor("#4f9a3f")).toBe("#4f9a3f");
  });
});

describe("Geometrie", () => {
  it("verteilt gemischte Folgen und schreibt das Startfeld fort", () => {
    const pages = layoutSequence(["a", "a", "b"], 11, 12);
    expect(pages).toHaveLength(2);
    expect(pages[0]!.slice(10)).toEqual(["a", "a"]);
    expect(pages[1]![0]).toBe("b");
    expect(nextFreeSlot(11, 3, 12)).toBe(2);
    expect(nextFreeSlot(1, 12, 12)).toBe(1);
    expect(nextFreeSlot(5, 3, 12)).toBe(8);
  });
  it("prüft Bogenformate", () => {
    expect(validateGeometry(DEFAULT_SHEET)).toEqual([]);
    expect(validateGeometry({ ...DEFAULT_SHEET, pitchX: 40 }).join()).toMatch(/Überlappung/);
    expect(validateGeometry({ ...DEFAULT_SHEET, columns: 7 }).join()).toMatch(/rechten Seitenrand/);
  });
  it("skaliert das Design auf andere Etikettgrößen", () => {
    expect(labelBox(DEFAULT_SHEET)).toEqual({ scale: 1, innerWidth: 45.5, innerHeight: 95.3 });
    const b = labelBox({ labelWidth: 63.5, labelHeight: 90 });
    expect(b.scale).toBeCloseTo(90 / 95.3, 4);
    expect(b.innerHeight).toBeCloseTo(95.3, 2);
    expect(b.innerWidth).toBeGreaterThan(45.5);
  });
  it("wählt Referenzpunkte auch bei nur einer Spalte", () => {
    const r = referencePoints({ ...DEFAULT_SHEET, columns: 1, rows: 2 });
    expect(r.aIndex).toBe(0);
    expect(r.bIndex).toBe(1);
  });
});

describe("Vorlagen und Motive", () => {
  it("normalisiert gespeicherte Parameter", () => {
    const p = normalizeParams({ variant: "gibts-nicht", titleMax: 99, titleMin: 30, bodyMin: "6,0" });
    expect(p.variant).toBe("klassisch");
    expect(p.titleMax).toBe(22);
    expect(p.titleMin).toBe(16);
    expect(p.bodyMin).toBe(5.6);
  });
  it("wählt Motive nach Teeart", () => {
    expect(resolveMotif("auto", "Kräutertee", false)).toBe("kraeuter");
    expect(resolveMotif("auto", "Früchtetee", false)).toBe("fruechte");
    expect(resolveMotif("auto", "Rooibos", false)).toBe("kanne");
    expect(resolveMotif("auto", "Grüner Tee", false)).toBe("tasse");
    expect(resolveMotif("bild", "Grüner Tee", false)).toBe("tasse");
    expect(resolveMotif("bild", "Grüner Tee", true)).toBe("bild");
  });
});
