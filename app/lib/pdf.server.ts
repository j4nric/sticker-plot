import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright-core";
import { fitLabelText } from "~/label/fit-text";
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

const globalForBrowser = globalThis as unknown as { __teaBrowser?: Promise<Browser> };

function getBrowser(): Promise<Browser> {
  if (!globalForBrowser.__teaBrowser) {
    const launching = chromium.launch({ executablePath: resolveChromiumPath() }).then((browser) => {
      browser.on("disconnected", () => {
        if (globalForBrowser.__teaBrowser === launching) globalForBrowser.__teaBrowser = undefined;
      });
      return browser;
    });
    launching.catch(() => {
      if (globalForBrowser.__teaBrowser === launching) globalForBrowser.__teaBrowser = undefined;
    });
    globalForBrowser.__teaBrowser = launching;
  }
  return globalForBrowser.__teaBrowser;
}

export async function closeBrowser() {
  const pending = globalForBrowser.__teaBrowser;
  globalForBrowser.__teaBrowser = undefined;
  if (pending) await (await pending).close().catch(() => {});
}

export interface PdfResult {
  pdf: Buffer;
  /** Anzahl Textfelder, die selbst in kleinster Schrift nicht passen */
  overflowing: number;
}

/**
 * Rendert ein vollständiges HTML-Dokument (A4 quer) zu PDF.
 * Externe Anfragen werden blockiert; alle Ressourcen sind eingebettet.
 */
export async function htmlToPdf(html: string): Promise<PdfResult> {
  const browser = await getBrowser();
  const context = await browser.newContext({ javaScriptEnabled: true, offline: true });
  try {
    const page = await context.newPage();
    await page.route("**/*", (route) => route.abort());
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMedia({ media: "print" });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const overflowing = await page.evaluate(fitLabelText, null);
    const pdf = await page.pdf({
      width: "297mm",
      height: "210mm",
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      printBackground: true,
      preferCSSPageSize: true,
    });
    return { pdf, overflowing };
  } finally {
    await context.close();
  }
}
