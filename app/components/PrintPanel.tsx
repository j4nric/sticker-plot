import { LABELS_PER_SHEET, layoutPages, SHEET } from "~/label/geometry";
import type { PrintLayout } from "./TeaEditor";

export interface PrinterOption {
  id: number;
  name: string;
  isDefault: boolean;
}

export function PrintPanel({
  teaId,
  printers,
  layout,
  onLayoutChange,
  disabledReason,
}: {
  teaId: number;
  printers: PrinterOption[];
  layout: PrintLayout;
  onLayoutChange: (layout: PrintLayout) => void;
  disabledReason?: string;
}) {
  const pages = layoutPages(layout.count, layout.start);
  const sheets = pages.length;
  const defaultPrinter = printers.find((p) => p.isDefault) ?? printers[0];
  const max = LABELS_PER_SHEET * 20;

  return (
    <form method="get" action={`/tees/${teaId}/etiketten.pdf`} target="_blank" className="card space-y-4" id="drucken">
      <h2 className="font-display text-lg tracking-wide uppercase">Drucken</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="drucker">
            Drucker
          </label>
          <select id="drucker" name="drucker" defaultValue={defaultPrinter?.id} className="field-input">
            {printers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isDefault ? " (Standard)" : ""}
              </option>
            ))}
          </select>
        </div>
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
            <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => onLayoutChange({ count: LABELS_PER_SHEET - layout.start + 1, start: layout.start })}>
              Rest des Bogens
            </button>
          </div>
        </div>
      </div>

      <fieldset>
        <legend className="field-label">Erstes freies Feld auf dem Bogen</legend>
        <p className="field-hint mb-2 mt-0">Bei angebrochenen Bögen das erste noch freie Etikett antippen.</p>
        <input type="hidden" name="start" value={layout.start} />
        <div
          className="grid max-w-sm gap-1 rounded-lg border border-stone-300 bg-stone-50 p-2"
          style={{ gridTemplateColumns: `repeat(${SHEET.columns}, minmax(0, 1fr))`, aspectRatio: `${SHEET.pageWidth} / ${SHEET.pageHeight}` }}
        >
          {pages[0]!.map((filled, i) => {
            const used = i < layout.start - 1;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onLayoutChange({ count: layout.count, start: i + 1 })}
                aria-pressed={layout.start === i + 1}
                className={`rounded border text-xs font-semibold transition-colors ${
                  used
                    ? "border-dashed border-stone-300 bg-stone-200 text-stone-400 line-through"
                    : filled
                      ? "border-brand-600 bg-brand-100 text-brand-800"
                      : "border-stone-300 bg-white text-stone-400"
                } ${layout.start === i + 1 ? "ring-2 ring-brand-600" : ""}`}
                title={used ? "bereits verbraucht" : filled ? "wird bedruckt" : "bleibt frei"}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </fieldset>

      <p className="text-sm text-stone-700">
        {layout.count} Etikett{layout.count === 1 ? "" : "en"} auf {sheets} Bogen{sheets === 1 ? "" : "/Bögen"}.
        {sheets > 1 ? " Ab dem zweiten Bogen wird bei Feld 1 begonnen." : ""}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={Boolean(disabledReason)}>
          PDF erstellen
        </button>
        {disabledReason ? <span className="text-sm text-amber-700">{disabledReason}</span> : null}
      </div>
      <p className="field-hint">Das PDF öffnet sich in einem neuen Tab. Beim Drucken „Tatsächliche Größe“ bzw. 100 % wählen.</p>
    </form>
  );
}
