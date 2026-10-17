import { existsSync } from "node:fs";
import { PDFDocument, PrintScaling } from "pdf-lib";
import { chromium } from "playwright-core";
import { afterAll, describe, expect, it } from "vitest";
import { closeBrowser, htmlToPdf, resolveChromiumPath } from "./pdf.server";
import { labelSheetsHtml, testSheetHtml, type SheetItem } from "./render.server";
import { DEFAULT_SHEET, NO_CALIBRATION } from "~/label/geometry";
import { DEFAULT_TEMPLATE_PARAMS, normalizeParams } from "~/label/template";

const shop = { name: "Tee-Treff-Punkt", url: "www.teetreffpunkt.de" };
const tea = {
  name: "China Sencha",
  teaType: "Grüner Tee",
  description:
    "Ein Grüntee mit mittelgrünem, flachgepresstem Blatt und einer feinherben, leicht heuigen Note, der in Asien besonders beliebt ist und einen hellgelben, duftigen Aufguss bietet.",
  ingredients: "Grüner Tee (China)",
  color: "#4f9a3f",
};
const item: SheetItem = { content: tea, template: DEFAULT_TEMPLATE_PARAMS };
const many = (n: number, i = item) => Array(n).fill(i) as SheetItem[];

const chromiumPath = resolveChromiumPath();
const hasChromium = existsSync(chromiumPath ?? chromium.executablePath());
const pageCount = async (pdf: Buffer) => (await PDFDocument.load(pdf)).getPageCount();
const pageSize = async (pdf: Buffer) => (await PDFDocument.load(pdf)).getPage(0).getSize();

describe.runIf(hasChromium)("PDF-Erzeugung", () => {
  afterAll(() => closeBrowser());

  it("erzeugt A4 quer mit passender Seitenzahl und Druckvorgabe 100 %", async () => {
    const { pdf, overflowing } = await htmlToPdf(labelSheetsHtml({ items: many(14), shop, calibration: NO_CALIBRATION, start: 3 }), { title: "Test" });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(await pageCount(pdf)).toBe(2);
    const size = await pageSize(pdf);
    expect(size.width).toBeCloseTo(841.9, 0);
    expect(size.height).toBeCloseTo(595, 0);
    expect(overflowing).toBe(0);
    const doc = await PDFDocument.load(pdf);
    expect(doc.catalog.getViewerPreferences()?.getPrintScaling()).toBe(PrintScaling.None);
    expect(doc.getTitle()).toBe("Test");
  });

  it("meldet Text, der nicht aufs Etikett passt", async () => {
    const long = { ...item, content: { ...tea, description: "Sehr langer Beschreibungstext. ".repeat(40) } };
    const { overflowing } = await htmlToPdf(labelSheetsHtml({ items: [long], shop, calibration: NO_CALIBRATION, start: 1 }));
    expect(overflowing).toBe(1);
  });

  it("bricht lange Teearten zweizeilig um statt abzuschneiden", async () => {
    const t = { ...item, content: { ...tea, teaType: "Aromatisierter Schwarzer Tee mit Stücken" } };
    const { overflowing } = await htmlToPdf(labelSheetsHtml({ items: [t], shop, calibration: NO_CALIBRATION, start: 1 }));
    expect(overflowing).toBe(0);
  });

  it("rendert alle Varianten, Codes und Druckangaben ohne Überlauf", async () => {
    const variants = (["klassisch", "band", "minimal"] as const).map((variant) => ({
      content: { ...tea, ean: "4006381333931", productUrl: "https://example.org/tee", price: "7,90 €", brewTemp: 80, brewTime: "3 Min.", organic: true },
      template: normalizeParams({ variant }),
    }));
    const { overflowing } = await htmlToPdf(
      labelSheetsHtml({ items: variants, shop: { ...shop, organicCode: "DE-ÖKO-006" }, calibration: NO_CALIBRATION, start: 1, extras: { netWeight: "100 g" } }),
    );
    expect(overflowing).toBe(0);
  });

  it("druckt formatierte Zutaten und jede Fußzeilenvariante ohne Überlauf", async () => {
    const content = { ...tea, ingredients: "Grüner Tee, *Mandeln*, ++Haselnüsse++, _Sahne_, *++_Soja_++*" };
    const html = labelSheetsHtml({ items: [{ content, template: DEFAULT_TEMPLATE_PARAMS }], shop, calibration: NO_CALIBRATION, start: 1 });
    expect(html).toContain('class="tl-b"');
    expect(html).toContain('class="tl-u"');
    expect(html).toContain('class="tl-i"');
    expect(html).toContain('class="tl-b tl-i tl-u"');
    for (const separator of ["blatt", "punkt", "strich", "keins"] as const) {
      const footer = { name: "*Tee-Treff-Punkt*", url: "www.teetreffpunkt.de", address: "Musterstraße 1 · 12345 Musterstadt", separator, footerItalic: separator !== "punkt" };
      const { overflowing } = await htmlToPdf(labelSheetsHtml({ items: [{ content, template: DEFAULT_TEMPLATE_PARAMS }], shop: footer, calibration: NO_CALIBRATION, start: 1 }));
      expect(overflowing).toBe(0);
    }
  });

  it("unterstützt andere Bogenformate", async () => {
    const format = { ...DEFAULT_SHEET, pageWidth: 210, pageHeight: 297, columns: 3, rows: 3, labelWidth: 63.5, labelHeight: 90, originX: 7, originY: 8, pitchX: 66, pitchY: 95 };
    const { pdf } = await htmlToPdf(labelSheetsHtml({ items: many(10), shop, format, calibration: NO_CALIBRATION, start: 1 }), { pageWidth: 210, pageHeight: 297 });
    expect(await pageCount(pdf)).toBe(2);
    expect((await pageSize(pdf)).width).toBeCloseTo(595, 0);
  });

  it("erzeugt den Testbogen", async () => {
    const { pdf } = await htmlToPdf(testSheetHtml({ calibration: NO_CALIBRATION, printerName: "Laden-Drucker" }));
    expect(await pageCount(pdf)).toBe(1);
  });
});
