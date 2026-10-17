import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fontFaceCss, LABEL_FONTS, type LabelFont } from "~/label/fonts";
import { DEFAULT_SHEET, labelsPerSheet, layoutSequence, type Calibration, type SheetGeometry } from "~/label/geometry";
import { Label, SheetPage, type LabelContent, type PrintExtras, type ShopInfo } from "~/label/Label";
import labelCss from "~/label/label.css?raw";
import { FONTS, type TemplateParams } from "~/label/template";
import { TestSheetPage } from "~/label/TestSheet";

const embeddedFontCss = new Map<string, string>();

/** Immer eingebettet: Standardschriften der Etiketten, Klarschrift der Strichcodes, Testbogen. */
const BASE_FAMILIES = ["Oswald", "Source Serif 4"];

function fontPath(font: LabelFont): string {
  const candidates = [resolve("build/client/fonts", font.file), resolve("public/fonts", font.file)];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`Schriftdatei ${font.file} nicht gefunden (gesucht in build/client/fonts und public/fonts)`);
  return found;
}

/**
 * Schriften als data:-URLs, damit Chromium keine Netzwerkzugriffe braucht.
 * Nur die benötigten Familien: Jede eingebettete Schrift kostet beim Laden
 * des Dokuments messbar Zeit.
 */
function pdfFontCss(families: string[]): string {
  const key = [...new Set([...BASE_FAMILIES, ...families])].sort().join("|");
  let css = embeddedFontCss.get(key);
  if (!css) {
    const used = LABEL_FONTS.filter((f) => key.split("|").includes(f.family));
    const data = new Map(used.map((f) => [f.file, readFileSync(fontPath(f)).toString("base64")]));
    css = fontFaceCss((f) => `data:font/woff2;base64,${data.get(f.file)}`, used);
    embeddedFontCss.set(key, css);
  }
  return css;
}

/** Familienname einer Vorlagenschrift, z. B. „Playfair Display“. */
const familyOf = (key: TemplateParams["titleFont"]) => FONTS[key].family.match(/^"([^"]+)"/)?.[1] ?? "";

export function buildDocument(body: ReactElement, page: Pick<SheetGeometry, "pageWidth" | "pageHeight"> = DEFAULT_SHEET, templates: TemplateParams[] = []): string {
  const pageCss = `@page{size:${page.pageWidth}mm ${page.pageHeight}mm;margin:0}html,body{margin:0;padding:0;background:#fff}`;
  const css = pageCss + pdfFontCss(templates.flatMap((t) => [familyOf(t.titleFont), familyOf(t.bodyFont)])) + labelCss;
  return (
    "<!doctype html>" +
    renderToStaticMarkup(
      <html lang="de">
        <head>
          <meta charSet="utf-8" />
          <style dangerouslySetInnerHTML={{ __html: css }} />
        </head>
        <body>{body}</body>
      </html>,
    )
  );
}

export interface SheetItem {
  content: LabelContent;
  template: TemplateParams;
}

export interface SheetJob {
  items: SheetItem[];
  shop: ShopInfo;
  format?: SheetGeometry;
  calibration: Calibration;
  start: number;
  extras?: PrintExtras;
}

/**
 * Bögen für eine Folge von Etiketten (eine Sorte oder gemischt).
 *
 * Jede Sorte wird nur einmal gerendert (im Bereich `.tl-stage`); die Felder
 * verweisen per `data-label-ref` darauf und werden im Browser nach dem
 * Anpassen der Schrift befüllt (`expandLabelRefs`). Das hält das HTML klein,
 * auch mit eigenem Bild, das sonst als data:-URL in jedem Feld stünde, und
 * die Schrift wird je Sorte nur einmal vermessen.
 * Gleiche Sorte heißt hier: dasselbe SheetItem-Objekt.
 */
export function labelSheetsHtml(job: SheetJob): string {
  const format = job.format ?? DEFAULT_SHEET;
  const ids = new Map<SheetItem, number>();
  for (const item of job.items) if (!ids.has(item)) ids.set(item, ids.size);
  const pages = layoutSequence(job.items, job.start, labelsPerSheet(format));
  return buildDocument(
    <>
      <div className="tl-stage">
        {[...ids].map(([item, id]) => (
          <div key={id} data-label-id={id}>
            <Label data={item.content} template={item.template} shop={job.shop} size={format} extras={job.extras} />
          </div>
        ))}
      </div>
      {pages.map((slots, p) => (
        <SheetPage key={p} format={format} calibration={job.calibration} slots={slots.map((item) => (item ? <div data-label-ref={ids.get(item)} /> : null))} />
      ))}
    </>,
    format,
    [...ids.keys()].map((item) => item.template),
  );
}

export function testSheetHtml(opts: { calibration: Calibration; printerName: string; createdAt?: Date; format?: SheetGeometry; formatName?: string }): string {
  const format = opts.format ?? DEFAULT_SHEET;
  return buildDocument(
    <TestSheetPage
      calibration={opts.calibration}
      printerName={opts.printerName}
      createdAt={opts.createdAt ?? new Date()}
      format={format}
      formatName={opts.formatName}
    />,
    format,
  );
}
