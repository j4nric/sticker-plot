import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fontFaceCss, LABEL_FONTS, type LabelFont } from "~/label/fonts";
import { DEFAULT_SHEET, labelsPerSheet, layoutSequence, type Calibration, type SheetGeometry } from "~/label/geometry";
import { Label, SheetPage, type LabelContent, type PrintExtras, type ShopInfo } from "~/label/Label";
import labelCss from "~/label/label.css?raw";
import type { TemplateParams } from "~/label/template";
import { TestSheetPage } from "~/label/TestSheet";

let embeddedFontCss: string | undefined;

function fontPath(font: LabelFont): string {
  const candidates = [resolve("build/client/fonts", font.file), resolve("public/fonts", font.file)];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`Schriftdatei ${font.file} nicht gefunden (gesucht in build/client/fonts und public/fonts)`);
  return found;
}

/** Schriften als data:-URLs, damit Chromium keine Netzwerkzugriffe braucht. */
function pdfFontCss(): string {
  if (!embeddedFontCss) {
    const data = new Map(LABEL_FONTS.map((f) => [f.file, readFileSync(fontPath(f)).toString("base64")]));
    embeddedFontCss = fontFaceCss((f) => `data:font/woff2;base64,${data.get(f.file)}`);
  }
  return embeddedFontCss;
}

export function buildDocument(body: ReactElement, page: Pick<SheetGeometry, "pageWidth" | "pageHeight"> = DEFAULT_SHEET): string {
  const pageCss = `@page{size:${page.pageWidth}mm ${page.pageHeight}mm;margin:0}html,body{margin:0;padding:0;background:#fff}`;
  const css = pageCss + pdfFontCss() + labelCss;
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

/** Bögen für eine Folge von Etiketten (eine Sorte oder gemischt). */
export function labelSheetsHtml(job: SheetJob): string {
  const format = job.format ?? DEFAULT_SHEET;
  const pages = layoutSequence(job.items, job.start, labelsPerSheet(format));
  return buildDocument(
    <>
      {pages.map((slots, p) => (
        <SheetPage
          key={p}
          format={format}
          calibration={job.calibration}
          slots={slots.map((item) =>
            item ? <Label data={item.content} template={item.template} shop={job.shop} size={format} extras={job.extras} /> : null,
          )}
        />
      ))}
    </>,
    format,
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
