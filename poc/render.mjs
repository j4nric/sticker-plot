// Proof of Concept: HTML-Bogen -> PDF über headless Chromium (Playwright).
// Aufruf: node render.mjs [out.pdf] [query-string]
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const out = process.argv[2] || 'out/sheet.pdf';
const query = process.argv[3] || '';
const candidates = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].filter(Boolean);
const executablePath = candidates.find(p => existsSync(p));

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();
await page.goto(pathToFileURL(resolve('template.html')).href + (query ? '?' + query : ''));
await page.emulateMedia({ media: 'print' });
await page.pdf({
  path: out,
  width: '297mm', height: '210mm',   // A4 quer
  printBackground: true,
  preferCSSPageSize: true,            // @page aus dem Template hat Vorrang
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});
await browser.close();
console.log('written', out, executablePath ? '' : '(default chromium)');
