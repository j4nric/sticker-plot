import { describe, expect, it } from "vitest";
import { fileSlug } from "./slug";
import { parseDecimal } from "./locale";
import { printRequest, readCalibration, readMeasurement, readTeaForm } from "./validation";

const form = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

describe("parseDecimal", () => {
  it("versteht Komma, Minus-Zeichen und Leerzeichen", () => {
    expect(parseDecimal("1,5")).toBe(1.5);
    expect(parseDecimal(" −2 ")).toBe(-2);
    expect(parseDecimal("-0.25")).toBe(-0.25);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal(null)).toBeNull();
  });
});

describe("readMeasurement", () => {
  it("dreht das Vorzeichen der Ablesewerte um", () => {
    const m = readMeasurement(form({ ax: "-2", ay: "1", bx: "", by: "0,5" }));
    expect(m.ok).toBe(true);
    expect(m.values).toEqual({ ax: 2, ay: -1, bx: 0, by: -0.5 });
  });
  it("weist unplausible Werte zurück", () => {
    expect(readMeasurement(form({ ax: "12" })).ok).toBe(false);
  });
});

describe("readCalibration", () => {
  it("rechnet Prozent in Faktoren um", () => {
    const c = readCalibration(form({ offsetX: "1,2", offsetY: "-0,4", scaleX: "100,5", scaleY: "99" }));
    expect(c).toEqual({ ok: true, value: { offsetX: 1.2, offsetY: -0.4, scaleX: 1.005, scaleY: 0.99 } });
  });
  it("meldet Werte außerhalb der Grenzen", () => {
    const c = readCalibration(form({ offsetX: "20", offsetY: "0", scaleX: "50", scaleY: "100" }));
    expect(c.ok).toBe(false);
  });
});

describe("readTeaForm", () => {
  it("trimmt und normalisiert", () => {
    const r = readTeaForm(form({ name: "  China Sencha ", title: "China Sencha", kind: "gruen", description: "a\r\nb", ingredients: "" }));
    expect(r.ok && r.value).toMatchObject({ name: "China Sencha", title: "", kind: "gruen", flavored: false, teaType: "Grüntee", description: "a\nb", ingredients: "", motif: "auto", brewTemp: null, organic: false });
    const flavored = readTeaForm(form({ name: "Kirsche", title: "Wilde\r\n\r\nKirsche ", kind: "rooibos", flavored: "on" }));
    expect(flavored.ok && flavored.value).toMatchObject({ title: "Wilde\nKirsche", teaType: "Aromatisierter Rooibostee" });
  });
  it("prüft Zubereitung, EAN, Link und nicht druckbare Zeichen", () => {
    const r = readTeaForm(form({ name: "Tee 🍵", kind: "gruen", brewTemp: "120", ean: "123", productUrl: "javascript:alert(1)" }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.name).toMatch(/nicht gedruckt/);
      expect(r.errors.brewTemp).toBeDefined();
      expect(r.errors.ean).toBeDefined();
      expect(r.errors.productUrl).toBeDefined();
    }
    const ok = readTeaForm(form({ name: "Mate", kind: "kraeuter", brewTemp: "90", brewTime: "5", ean: "400638133393", organic: "on", shelfLifeMonths: "24" }));
    expect(ok.ok && ok.value).toMatchObject({ brewTemp: 90, brewTime: "5 Min.", ean: "4006381333931", organic: true, shelfLifeMonths: 24 });
  });

  it("verlangt Namen und eine der fünf Teearten", () => {
    const r = readTeaForm(form({ name: " ", kind: "oolong" }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.name).toBeDefined();
      expect(r.errors.kind).toBe("Bitte eine Teeart wählen");
    }
  });
});

describe("printRequest", () => {
  it("setzt Standardwerte und prüft Grenzen", () => {
    expect(printRequest.parse({})).toEqual({ anzahl: 12, start: 1 });
    expect(printRequest.safeParse({ start: "801" }).success).toBe(false);
    expect(printRequest.safeParse({ anzahl: "0" }).success).toBe(false);
    expect(printRequest.parse({ drucker: "2", anzahl: "30", start: "4" })).toEqual({ drucker: 2, anzahl: 30, start: 4 });
  });
});

describe("fileSlug", () => {
  it("ersetzt Umlaute und Sonderzeichen", () => {
    expect(fileSlug("Grüner Löwe & Süßholz")).toBe("gruener-loewe-suessholz");
    expect(fileSlug("!!!")).toBe("tee");
  });
});
