import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRevalidator } from "react-router";
import { labelsPerSheet, layoutPages, MAX_PRINT_LABELS, type PrintLayout } from "~/label/geometry";
import { PdfDialog, type PdfRequest } from "./PdfDialog";
import { SlotPicker } from "./SlotPicker";
import type { FormatOption, PrinterOption, useDeviceChoice } from "./useDeviceChoice";

/** Zufällige Kennung je Druckauftrag (auch ohne HTTPS, wo randomUUID fehlt). */
function newJobId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function addMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function PrintPanel({
  action,
  hiddenFields,
  printers,
  formats,
  choice,
  layout,
  onLayoutChange,
  disabledReason,
  shelfLifeMonths,
  colors,
  maxCount,
  countEditable = true,
  children,
}: {
  action: string;
  hiddenFields?: Record<string, string>;
  printers: PrinterOption[];
  formats: FormatOption[];
  choice: ReturnType<typeof useDeviceChoice>;
  layout: PrintLayout;
  onLayoutChange: (layout: PrintLayout) => void;
  disabledReason?: string;
  shelfLifeMonths?: number | null;
  colors?: (string | null)[];
  maxCount?: number;
  countEditable?: boolean;
  children?: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const { revalidate } = useRevalidator();
  const [request, setRequest] = useState<PdfRequest | null>(null);
  const [mhd, setMhd] = useState(shelfLifeMonths ? addMonths(shelfLifeMonths) : "");
  const format = choice.format;
  const perSheet = labelsPerSheet(format);
  const pages = layoutPages(layout.count, layout.start, perSheet);
  const sheets = pages.length;
  const max = Math.min(maxCount ?? perSheet * 20, MAX_PRINT_LABELS);

  // Startfeld des gewählten Druckers übernehmen (angebrochener Bogen); nach
  // einem Druck kommt der fortgeschriebene Wert mit den neu geladenen Daten
  useEffect(() => {
    onLayoutChange({ count: layout.count, start: Math.min(choice.printer.nextSlot, perSheet) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice.printerId, choice.printer.nextSlot, perSheet]);

  // PDF in der App erzeugen und anzeigen (kein neuer Tab, siehe PdfDialog)
  const open = (kind: PdfRequest["kind"]) => {
    const params = new URLSearchParams();
    new FormData(formRef.current!).forEach((v, k) => {
      if (typeof v === "string" && v !== "") params.set(k, v);
    });
    if (kind === "preview") params.set("vorschau", "1");
    else params.set("auftrag", newJobId());
    setRequest({ url: `${action}?${params}`, fileName: "etiketten.pdf", kind });
  };

  return (
    <form
      ref={formRef}
      method="get"
      action={action}
      className="card space-y-4"
      id="drucken"
      onSubmit={(e) => {
        e.preventDefault();
        open("print");
      }}
    >
      <h2 className="font-display text-lg tracking-wide uppercase">Drucken</h2>
      {Object.entries(hiddenFields ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="drucker">
            Drucker
          </label>
          <select id="drucker" name="drucker" value={choice.printerId} onChange={(e) => choice.choosePrinter(Number(e.target.value))} className="field-input">
            {printers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isDefault ? " (Standard)" : ""}
              </option>
            ))}
          </select>
        </div>
        {formats.length > 1 ? (
          <div>
            <label className="field-label" htmlFor="format">
              Bogenformat
            </label>
            <select id="format" name="format" value={choice.formatId} onChange={(e) => choice.chooseFormat(Number(e.target.value))} className="field-input">
              {formats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="format" value={choice.formatId} />
        )}
        {countEditable ? (
          <div>
            <label className="field-label" htmlFor="anzahl">
              Anzahl Etiketten
            </label>
            <div className="flex items-center gap-2">
              <input
                id="anzahl"
                name="anzahl"
                type="number"
                min={1}
                max={max}
                value={layout.count}
                onChange={(e) => onLayoutChange({ ...layout, count: Math.min(max, Math.max(1, Number(e.target.value) || 1)) })}
                className="field-input w-24"
              />
              <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => onLayoutChange({ count: perSheet - layout.start + 1, start: layout.start })}>
                Rest des Bogens
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {children}

      <fieldset>
        <legend className="field-label">Erstes freies Feld auf dem Bogen</legend>
        <p className="field-hint mt-0 mb-2">
          Die App merkt sich pro Drucker, wo der letzte Druck aufgehört hat. Bei einem neuen Bogen auf „Neuer Bogen“ tippen.
        </p>
        <input type="hidden" name="start" value={layout.start} />
        <div className="flex flex-wrap items-start gap-3">
          <SlotPicker
            columns={format.columns}
            rows={format.rows}
            pageWidth={format.pageWidth}
            pageHeight={format.pageHeight}
            start={layout.start}
            fill={pages[0]!}
            colors={colors}
            onPick={(start) => onLayoutChange({ count: layout.count, start })}
          />
          <button type="button" className="btn-secondary px-3 py-1 text-sm" onClick={() => onLayoutChange({ count: layout.count, start: 1 })}>
            Neuer Bogen
          </button>
        </div>
      </fieldset>

      <details className="rounded-lg border border-stone-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-stone-700">Druckangaben (optional): Füllmenge, MHD, Los</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="field-label" htmlFor="menge">
              Füllmenge
            </label>
            <input id="menge" name="menge" placeholder="z. B. 100 g" maxLength={30} className="field-input" />
          </div>
          <div>
            <label className="field-label" htmlFor="mhd">
              MHD
            </label>
            <input id="mhd" name="mhd" type="date" value={mhd} onChange={(e) => setMhd(e.target.value)} className="field-input" />
          </div>
          <div>
            <label className="field-label" htmlFor="los">
              Los
            </label>
            <input id="los" name="los" placeholder="z. B. L2610" maxLength={30} className="field-input" />
          </div>
        </div>
        <p className="field-hint">Erscheint als kleine Zeile über der Fußzeile, nur wenn ausgefüllt.</p>
      </details>

      <p className="text-sm text-stone-700">
        {layout.count} Etikett{layout.count === 1 ? "" : "en"} auf {sheets} Bogen{sheets === 1 ? "" : "/Bögen"}.
        {sheets > 1 ? " Ab dem zweiten Bogen wird bei Feld 1 begonnen." : ""}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={Boolean(disabledReason)}>
          PDF erstellen
        </button>
        <button type="button" className="btn-secondary" disabled={Boolean(disabledReason)} onClick={() => open("preview")}>
          Vorschau
        </button>
        {disabledReason ? <span className="text-sm text-amber-700">{disabledReason}</span> : null}
      </div>
      <p className="field-hint">„PDF erstellen“ bucht den Druck und schreibt das Startfeld fort, „Vorschau“ nicht.</p>
      {/* nach dem Erstellen das fortgeschriebene Startfeld vom Server holen */}
      <PdfDialog request={request} onClose={() => setRequest(null)} onCreated={() => void revalidate()} />
    </form>
  );
}
