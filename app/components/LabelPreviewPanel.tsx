import { memo, useDeferredValue, useMemo, useState } from "react";
import { labelsPerSheet, layoutPages, type PrintLayout, type SheetGeometry } from "~/label/geometry";
import { Label, SheetPage, type LabelContent, type ShopInfo } from "~/label/Label";
import type { TemplateParams } from "~/label/template";
import { FitMeter, FittedPreview, type FitReport } from "./FittedPreview";

/**
 * Vorschau im Editor: einzelnes Etikett oder erster Bogen.
 *
 * Die Vorschau darf beim Tippen einen Tastendruck hinterherhinken
 * (useDeferredValue): Eingaben bleiben flüssig, auch wenn ein ganzer Bogen
 * neu gesetzt und vermessen wird.
 */
export const LabelPreviewPanel = memo(function LabelPreviewPanel({
  content,
  shop,
  template,
  format,
  printLayout,
  onOverflowChange,
}: {
  content: LabelContent;
  shop: ShopInfo;
  template: TemplateParams;
  format: SheetGeometry;
  printLayout?: PrintLayout;
  onOverflowChange: (overflowing: boolean) => void;
}) {
  const [view, setView] = useState<"label" | "sheet">("label");
  const [report, setReport] = useState<FitReport | null>(null);
  const data = useDeferredValue(content);
  const perSheet = labelsPerSheet(format);
  const count = printLayout?.count ?? perSheet;
  const start = printLayout?.start ?? 1;

  const fitKey = JSON.stringify([data, view, template, format, count, start]);
  const preview = useMemo(() => {
    const label = <Label data={data} shop={shop} template={template} size={format} />;
    if (view === "label") return { label, width: format.labelWidth, height: format.labelHeight };
    const firstSheet = layoutPages(count, start, perSheet)[0]!;
    return { label: <SheetPage format={format} slots={firstSheet.map((filled) => (filled ? label : null))} />, width: format.pageWidth, height: format.pageHeight };
  }, [data, shop, template, format, view, count, start, perSheet]);

  const scale =
    view === "label"
      ? Math.min(1.8, 330 / ((format.labelWidth * 96) / 25.4), 640 / ((format.labelHeight * 96) / 25.4))
      : Math.min(0.42, 380 / ((format.pageWidth * 96) / 25.4));

  const onFit = (r: FitReport) => {
    setReport(r);
    onOverflowChange(r.overflow > 0);
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg tracking-wide uppercase">Vorschau</h2>
        <div className="flex rounded-lg border border-stone-300 p-0.5 text-sm">
          {(["label", "sheet"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className={`rounded-md px-3 py-1 ${view === v ? "bg-stone-800 text-white" : "text-stone-700"}`}>
              {v === "label" ? "Etikett" : "Bogen"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-center overflow-x-auto">
        <FittedPreview widthMm={preview.width} heightMm={preview.height} scale={scale} fitKey={fitKey} onFit={onFit} className="shadow-lg ring-1 ring-stone-200">
          {preview.label}
        </FittedPreview>
      </div>
      <FitMeter report={report} min={template.bodyMin} max={template.bodyMax} />
      <p className="text-center text-xs text-stone-500">
        {view === "label" ? "Darstellung entspricht dem Druck." : "Erster Bogen ohne Druckerkorrektur, freie Felder bleiben leer."}
      </p>
    </div>
  );
});
