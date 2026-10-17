import { useEffect, useRef, useState, type ReactNode } from "react";
import { labelsPerSheet, layoutPages, nextFreeSlot, type SheetGeometry } from "~/label/geometry";
import { PdfDialog } from "./PdfDialog";
import { SlotPicker } from "./SlotPicker";
import type { PrintLayout } from "./TeaEditor";

export interface PrinterOption {
  id: number;
  name: string;
  isDefault: boolean;
  nextSlot: number;
}
export type FormatOption = SheetGeometry & { id: number; name: string; isDefault: boolean };

const store = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // privater Modus o. Ä.: Merken ist nur Komfort
    }
  },
};

/** Drucker und Format für dieses Gerät merken und wiederherstellen. */
export function useDeviceChoice(printers: PrinterOption[], formats: FormatOption[]) {
  const def = (list: { id: number; isDefault: boolean }[]) => (list.find((x) => x.isDefault) ?? list[0])!.id;
  const [printerId, setPrinterId] = useState(def(printers));
  const [formatId, setFormatId] = useState(def(formats));
  useEffect(() => {
    const p = Number(store.get("tee.drucker"));
    if (printers.some((x) => x.id === p)) setPrinterId(p);
    const f = Number(store.get("tee.format"));
    if (formats.some((x) => x.id === f)) setFormatId(f);
  }, [printers, formats]);
  return {
    printerId,
    formatId,
    printer: printers.find((p) => p.id === printerId) ?? printers[0]!,
    format: formats.find((f) => f.id === formatId) ?? formats[0]!,
    choosePrinter(id: number) {
      setPrinterId(id);
      store.set("tee.drucker", String(id));
    },
    chooseFormat(id: number) {
      setFormatId(id);
      store.set("tee.format", String(id));
    },
  };
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mhd, setMhd] = useState(shelfLifeMonths ? addMonths(shelfLifeMonths) : "");
  const format = choice.format;
  const perSheet = labelsPerSheet(format);
  const pages = layoutPages(layout.count, layout.start, perSheet);
  const sheets = pages.length;
  const max = maxCount ?? perSheet * 20;

  // Startfeld des gewählten Druckers übernehmen (angebrochener Bogen)
  useEffect(() => {
    onLayoutChange({ count: layout.count, start: Math.min(choice.printer.nextSlot, perSheet) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice.printerId, perSheet]);

  const buildUrl = () => {
    const params = new URLSearchParams();
    new FormData(formRef.current!).forEach((v, k) => {
      if (typeof v === "string" && v !== "") params.set(k, v);
    });
    params.set("vorschau", "1");
    return `${action}?${params}`;
  };

  return (
    <form
      ref={formRef}
      method="get"
      action={action}
      target="_blank"
      className="card space-y-4"
      id="drucken"
      onSubmit={() => {
        // Nach dem Druck liegt der angebrochene Bogen im Drucker: Startfeld fortschreiben
        setTimeout(() => onLayoutChange({ count: layout.count, start: nextFreeSlot(layout.start, layout.count, perSheet) }), 0);
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
        <button type="button" className="btn-secondary" disabled={Boolean(disabledReason)} onClick={() => setPreviewUrl(buildUrl())}>
          Vorschau
        </button>
        {disabledReason ? <span className="text-sm text-amber-700">{disabledReason}</span> : null}
      </div>
      <p className="field-hint">Das PDF öffnet sich in einem neuen Tab. Beim Drucken „Tatsächliche Größe“ bzw. 100 % wählen.</p>
      <PdfDialog url={previewUrl} onClose={() => setPreviewUrl(null)} />
    </form>
  );
}
