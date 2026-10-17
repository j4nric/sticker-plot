import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PDFDocument, PrintScaling } from "pdf-lib";
import { chromium, type Browser, type BrowserContext } from "playwright-core";
import { expandLabelRefs, fitLabelText } from "~/label/fit-text";
import { env } from "./env.server";

/**
 * Findet ein Chromium: CHROMIUM_PATH, sonst das zur Playwright-Version
 * passende, sonst das neueste installierte im Playwright-Browserverzeichnis.
 */
export function resolveChromiumPath(): string | undefined {
  if (env.chromiumPath) return env.chromiumPath;
  try {
    if (existsSync(chromium.executablePath())) return undefined;
  } catch {
    // Playwright kennt keinen Standardpfad, weiter unten suchen
  }
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), ".cache", "ms-playwright");
  if (!existsSync(base)) return undefined;
  const dirs = readdirSync(base).sort().reverse();
  const candidates = [
    ...dirs.filter((d) => d.startsWith("chromium_headless_shell-")).map((d) => join(base, d, "chrome-linux", "headless_shell")),
    ...dirs.filter((d) => d.startsWith("chromium_headless_shell-")).map((d) => join(base, d, "chrome-headless-shell-linux64", "chrome-headless-shell")),
    ...dirs.filter((d) => /^chromium-\d+$/.test(d)).map((d) => join(base, d, "chrome-linux", "chrome")),
  ];
  return candidates.find((p) => existsSync(p));
}

/**
 * Ein Browser mit einem gemeinsamen Kontext für alle Anfragen; jede Anfrage
 * bekommt nur eine eigene Seite. Das spart je PDF das Anlegen eines Kontexts.
 * Netzwerk ist aus: alle Ressourcen sind eingebettet.
 */
interface Renderer {
  browser: Browser;
  context: BrowserContext;
}

const globalForBrowser = globalThis as unknown as { __teaRenderer?: Promise<Renderer> };

function getRenderer(): Promise<Renderer> {
  if (!globalForBrowser.__teaRenderer) {
    const launching = (async () => {
      const browser = await chromium.launch({ executablePath: resolveChromiumPath() });
      browser.on("disconnected", () => {
        if (globalForBrowser.__teaRenderer === launching) globalForBrowser.__teaRenderer = undefined;
      });
      const context = await browser.newContext({ offline: true });
      await context.route("**/*", (route) => route.abort());
      return { browser, context };
    })();
    launching.catch(() => {
      if (globalForBrowser.__teaRenderer === launching) globalForBrowser.__teaRenderer = undefined;
    });
    globalForBrowser.__teaRenderer = launching;
  }
  return globalForBrowser.__teaRenderer;
}

export async function closeBrowser() {
  const pending = globalForBrowser.__teaRenderer;
  globalForBrowser.__teaRenderer = undefined;
  if (pending) await (await pending).browser.close().catch(() => {});
}

export interface PdfResult {
  pdf: Buffer;
  /** Anzahl Textfelder, die selbst in kleinster Schrift nicht passen */
  overflowing: number;
}

/**
 * Setzt Metadaten und die Druckvorgabe „keine Skalierung“. Acrobat und viele
 * Druckdialoge übernehmen damit automatisch 100 %.
 */
async function finalizePdf(pdf: Buffer, title: string): Promise<Buffer> {
  try {
    const doc = await PDFDocument.load(pdf, { updateMetadata: false });
    doc.setTitle(title);
    doc.setProducer("Tee-Etiketten");
    doc.setCreator("Tee-Etiketten");
    const prefs = doc.catalog.getOrCreateViewerPreferences();
    prefs.setPrintScaling(PrintScaling.None);
    prefs.setDisplayDocTitle(true);
    return Buffer.from(await doc.save({ useObjectStreams: true }));
  } catch {
    return pdf;
  }
}

export interface PdfOptions {
  pageWidth?: number;
  pageHeight?: number;
  title?: string;
}

/**
 * Rendert ein vollständiges HTML-Dokument zu PDF.
 * Externe Anfragen werden blockiert; alle Ressourcen sind eingebettet.
 */
export async function htmlToPdf(html: string, opts: PdfOptions = {}): Promise<PdfResult> {
  const { context } = await getRenderer();
  const page = await context.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMedia({ media: "print" });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const fitted = await page.evaluate(fitLabelText, null);
    const expanded = await page.evaluate(expandLabelRefs);
    const raw = await page.pdf({
      width: `${opts.pageWidth ?? 297}mm`,
      height: `${opts.pageHeight ?? 210}mm`,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      printBackground: true,
      preferCSSPageSize: true,
    });
    return { pdf: await finalizePdf(raw, opts.title ?? "Etiketten"), overflowing: expanded ?? fitted };
  } finally {
    await page.close();
  }
}
