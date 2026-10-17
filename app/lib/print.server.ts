import { labelsPerSheet, nextFreeSlot } from "~/label/geometry";
import type { PrintExtras } from "~/label/Label";
import { resolveFormat } from "~/models/format.server";
import { imageDataUrl } from "~/models/image.server";
import { getPrinter, resolvePrinter, setNextSlot, toCalibration } from "~/models/printer.server";
import { getSettings } from "~/models/settings.server";
import { getTea, recordPrintJob, toLabelContent } from "~/models/tea.server";
import { resolveTemplate } from "~/models/template.server";
import type { SessionUser } from "~/models/user.server";
import { htmlToPdf } from "./pdf.server";
import { labelSheetsHtml, type SheetItem } from "./render.server";

export interface PrintOrder {
  lines: { teaId: number; count: number }[];
  printerId?: number;
  formatId?: number;
  start: number;
  extras?: PrintExtras;
  /** trotz Textüberlauf erzeugen */
  force?: boolean;
  /** nur ansehen: nicht protokollieren, Startfeld nicht fortschreiben */
  preview?: boolean;
  /** Kennung des Klicks auf „PDF erstellen“; derselbe Auftrag zählt nur einmal */
  jobId?: string;
  user: SessionUser;
  title: string;
}

export type PrintOutcome =
  | { ok: true; pdf: Buffer; nextSlot: number }
  | { ok: false; status: 400 | 404 | 422; message: string; overflowing?: number };

/**
 * Zuletzt erzeugte Aufträge: Lädt der Browser oder PDF-Betrachter dieselbe
 * Adresse erneut (Neu laden, Herunterladen, Drucken aus der Vorschau), kommt
 * das fertige PDF ohne neuen Protokolleintrag und ohne das Startfeld noch
 * einmal fortzuschreiben.
 */
const recentJobs = new Map<string, { pdf: Buffer; nextSlot: number; at: number }>();
const RECENT_MAX = 8;
const RECENT_MS = 15 * 60 * 1000;

function rememberJob(id: string, pdf: Buffer, nextSlot: number) {
  const now = Date.now();
  for (const [key, job] of recentJobs) if (now - job.at > RECENT_MS) recentJobs.delete(key);
  while (recentJobs.size >= RECENT_MAX) recentJobs.delete(recentJobs.keys().next().value!);
  recentJobs.set(id, { pdf, nextSlot, at: now });
}

export async function printLabels(order: PrintOrder): Promise<PrintOutcome> {
  const repeated = order.jobId && !order.preview ? recentJobs.get(`${order.user.id}:${order.jobId}`) : undefined;
  if (repeated) return { ok: true, pdf: repeated.pdf, nextSlot: repeated.nextSlot };
  if (order.printerId && !getPrinter(order.printerId)) {
    return { ok: false, status: 404, message: "Der gewählte Drucker existiert nicht mehr. Bitte die Seite neu laden und einen Drucker wählen." };
  }
  const printer = resolvePrinter(order.printerId);
  const format = resolveFormat(order.formatId);
  const settings = getSettings();
  const perSheet = labelsPerSheet(format);
  const start = Math.min(Math.max(1, order.start), perSheet);

  const items: SheetItem[] = [];
  const teaNames: { id: number; name: string; count: number }[] = [];
  for (const line of order.lines) {
    const tea = getTea(line.teaId);
    if (!tea) return { ok: false, status: 404, message: `Tee ${line.teaId} wurde nicht gefunden.` };
    const item: SheetItem = { content: toLabelContent(tea, imageDataUrl(tea.imageId)), template: resolveTemplate(tea.templateId).params };
    for (let i = 0; i < line.count; i++) items.push(item);
    teaNames.push({ id: tea.id, name: tea.name, count: line.count });
  }
  if (!items.length) return { ok: false, status: 400, message: "Keine Etiketten ausgewählt." };

  const extras = order.extras && Object.values(order.extras).some(Boolean) ? order.extras : undefined;
  const html = labelSheetsHtml({ items, shop: settings.shop, format, calibration: toCalibration(printer), start, extras });
  const { pdf, overflowing } = await htmlToPdf(html, { pageWidth: format.pageWidth, pageHeight: format.pageHeight, title: order.title });

  if (overflowing > 0 && settings.overflowPolicy === "block" && !order.force) {
    return {
      ok: false,
      status: 422,
      overflowing,
      message: "Auf mindestens einem Etikett passt der Text selbst in kleinster Schrift nicht vollständig. Bitte Text kürzen.",
    };
  }

  const next = nextFreeSlot(start, items.length, perSheet);
  if (order.preview) return { ok: true, pdf, nextSlot: printer.nextSlot };
  for (const t of teaNames) {
    recordPrintJob({ teaId: t.id, teaName: t.name, printerId: printer.id, labelCount: t.count, startPosition: start, userName: order.user.username });
  }
  setNextSlot(printer.id, next);
  if (order.jobId) rememberJob(`${order.user.id}:${order.jobId}`, pdf, next);
  return { ok: true, pdf, nextSlot: next };
}

export function pdfResponse(pdf: Buffer, fileName: string): Response {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Einfache HTML-Seite für Fehler beim PDF-Erzeugen (öffnet sich im neuen Tab). */
export function printErrorResponse(outcome: Extract<PrintOutcome, { ok: false }>, request: Request): Response {
  const url = new URL(request.url);
  url.searchParams.set("trotzdem", "1");
  const force =
    outcome.status === 422
      ? `<p><a class="b2" href="${esc(url.pathname + url.search)}">Trotzdem erstellen (Text wird abgeschnitten)</a></p>`
      : "";
  const html = `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Etiketten nicht erstellt</title>
<style>body{font:16px/1.5 Georgia,serif;max-width:36rem;margin:4rem auto;padding:0 1rem;color:#222}h1{font:600 1.5rem/1.2 sans-serif}a{display:inline-block;margin-top:.5rem;padding:.5rem 1rem;border-radius:.5rem;background:#326628;color:#fff;text-decoration:none}a.b2{background:#fff;color:#7a2a1a;border:1px solid #e5c5bd}</style>
<h1>Etiketten wurden nicht erstellt</h1><p>${esc(outcome.message)}</p>${force}<p><a href="javascript:window.close()">Tab schließen</a></p></html>`;
  return new Response(html, { status: outcome.status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
