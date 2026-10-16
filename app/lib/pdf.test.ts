import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { afterAll, describe, expect, it } from "vitest";
import { closeBrowser, htmlToPdf, resolveChromiumPath } from "./pdf.server";
import { labelSheetsHtml, testSheetHtml } from "./render.server";
import { NO_CALIBRATION } from "~/label/geometry";

const shop = { name: "Tee-Treff-Punkt", url: "www.teetreffpunkt.de" };
const tea = {
  name: "China Sencha",
  teaType: "Grüner Tee",
  description:
    "Ein Grüntee mit mittelgrünem, flachgepresstem Blatt und einer feinherben, leicht heuigen Note, der in Asien besonders beliebt ist und einen hellgelben, duftigen Aufguss bietet.",
  ingredients: "Grüner Tee (China)",
  color: "#4f9a3f",
};

const chromiumPath = resolveChromiumPath();
const hasChromium = existsSync(chromiumPath ?? chromium.executablePath());

const pageCount = (pdf: Buffer) => Number(pdf.toString("latin1").match(/\/Type\s*\/Pages\s*\/Count\s+(\d+)/)?.[1]);

describe.runIf(hasChromium)("PDF-Erzeugung", () => {
  afterAll(() => closeBrowser());

  it("erzeugt A4 quer mit passender Seitenzahl", async () => {
    const { pdf, overflowing } = await htmlToPdf(labelSheetsHtml({ data: tea, shop, calibration: NO_CALIBRATION, count: 14, start: 3 }));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pageCount(pdf)).toBe(2);
    const box = pdf.toString("latin1").match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/);
    expect(Number(box![1])).toBeCloseTo(841.9, 0);
    expect(Number(box![2])).toBeCloseTo(595, 0);
    expect(overflowing).toBe(0);
  });

  it("meldet Text, der nicht aufs Etikett passt", async () => {
    const long = { ...tea, description: "Sehr langer Beschreibungstext. ".repeat(40) };
    const { overflowing } = await htmlToPdf(labelSheetsHtml({ data: long, shop, calibration: NO_CALIBRATION, count: 1, start: 1 }));
    expect(overflowing).toBe(1);
  });

  it("erzeugt den Testbogen", async () => {
    const { pdf } = await htmlToPdf(testSheetHtml({ calibration: NO_CALIBRATION, printerName: "Laden-Drucker" }));
    expect(pageCount(pdf)).toBe(1);
  });
});
