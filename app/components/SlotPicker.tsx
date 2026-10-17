/** Auswahl des ersten freien Feldes auf dem Bogen, für beliebige Raster. */
export function SlotPicker({
  columns,
  rows,
  pageWidth,
  pageHeight,
  start,
  fill,
  onPick,
  colors,
}: {
  columns: number;
  rows: number;
  pageWidth: number;
  pageHeight: number;
  start: number;
  /** pro Feld: wird bedruckt? */
  fill: boolean[];
  onPick: (slot: number) => void;
  /** optionale Farbe je Feld (Sammeldruck) */
  colors?: (string | null)[];
}) {
  const total = columns * rows;
  return (
    <div
      className="grid w-full max-w-sm min-w-56 flex-1 gap-1 rounded-lg border border-stone-300 bg-stone-50 p-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, aspectRatio: `${pageWidth} / ${pageHeight}` }}
    >
      {Array.from({ length: total }, (_, i) => {
        const used = i < start - 1;
        const filled = fill[i];
        const color = colors?.[i];
        return (
          <button
            key={i}
            type="button"
            onClick={() => onPick(i + 1)}
            aria-pressed={start === i + 1}
            className={`rounded border text-xs font-semibold transition-colors ${
              used
                ? "border-dashed border-stone-300 bg-stone-200 text-stone-400 line-through"
                : filled
                  ? "border-brand-600 bg-brand-100 text-brand-800"
                  : "border-stone-300 bg-white text-stone-400"
            } ${start === i + 1 ? "ring-2 ring-brand-600" : ""}`}
            style={filled && color ? { background: `color-mix(in srgb, ${color} 30%, white)`, borderColor: color } : undefined}
            title={used ? "bereits verbraucht" : filled ? "wird bedruckt" : "bleibt frei"}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
