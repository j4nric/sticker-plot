import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fontFaceCss, LABEL_FONTS, type LabelFont } from "~/label/fonts";
import { layoutPages, type Calibration } from "~/label/geometry";
import { Label, SheetPage, type LabelData, type ShopInfo } from "~/label/Label";
import labelCss from "~/label/label.css?raw";
import { TestSheetPage } from "~/label/TestSheet";

const PAGE_CSS = "@page{size:297mm 210mm;margin:0}html,body{margin:0;padding:0;background:#fff}";

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

export function buildDocument(body: ReactElement): string {
  const css = PAGE_CSS + pdfFontCss() + labelCss;
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

export function labelSheetsHtml(opts: {
  data: LabelData;
  shop: ShopInfo;
  calibration: Calibration;
  count: number;
  start: number;
}): string {
  const pages = layoutPages(opts.count, opts.start);
  return buildDocument(
    <>
      {pages.map((slots, p) => (
        <SheetPage
          key={p}
          calibration={opts.calibration}
          slots={slots.map((filled) => (filled ? <Label data={opts.data} shop={opts.shop} /> : null))}
        />
      ))}
    </>,
  );
}

export function testSheetHtml(opts: { calibration: Calibration; printerName: string; createdAt?: Date }): string {
  return buildDocument(
    <TestSheetPage calibration={opts.calibration} printerName={opts.printerName} createdAt={opts.createdAt ?? new Date()} />,
  );
}
