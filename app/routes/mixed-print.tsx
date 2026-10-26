import { useMemo, useState } from "react";
import { PrintPanel } from "~/components/PrintPanel";
import { useDeviceChoice } from "~/components/useDeviceChoice";
import { editorData } from "~/lib/editor.server";
import { labelsPerSheet, layoutSequence, MAX_PRINT_LABELS, type PrintLayout } from "~/label/geometry";
import { getKindSettings } from "~/models/settings.server";
import { listTeas, teaColor } from "~/models/tea.server";
import type { Route } from "./+types/mixed-print";

export function meta() {
  return [{ title: "Sammeldruck · Tee-Etiketten" }];
}

export function loader() {
  const d = editorData();
  const kinds = getKindSettings();
  return { teas: listTeas().map((t) => ({ id: t.id, name: t.name, teaType: t.teaType, color: teaColor(t, kinds) })), printers: d.printers, formats: d.formats };
}

export default function MixedPrint({ loaderData }: Route.ComponentProps) {
  const { teas, printers, formats } = loaderData;
  const choice = useDeviceChoice(printers, formats);
  const perSheet = labelsPerSheet(choice.format);
  const [lines, setLines] = useState<{ teaId: number; count: number }[]>([]);
  const [filter, setFilter] = useState("");
  const [layout, setLayout] = useState<PrintLayout>({ count: 0, start: Math.min(choice.printer.nextSlot, perSheet) });
  const total = lines.reduce((s, l) => s + l.count, 0);
  const byId = useMemo(() => new Map(teas.map((t) => [t.id, t])), [teas]);

  const setCount = (teaId: number, count: number) =>
    setLines((ls) => {
      const c = Math.max(0, Math.min(MAX_PRINT_LABELS, Math.floor(count) || 0));
      const exists = ls.some((l) => l.teaId === teaId);
      if (c === 0) return ls.filter((l) => l.teaId !== teaId);
      return exists ? ls.map((l) => (l.teaId === teaId ? { ...l, count: c } : l)) : [...ls, { teaId, count: c }];
    });

  const sequence = lines.flatMap((l) => Array(l.count).fill(byId.get(l.teaId)?.color ?? "#999") as string[]);
  const firstPage = layoutSequence(sequence, layout.start, perSheet)[0]!;
  const visible = teas.filter((t) => !filter || `${t.name} ${t.teaType}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl tracking-wide uppercase">Sammeldruck</h1>
      <p className="max-w-3xl text-stone-700">Mehrere Sorten auf einem Bogen drucken, z. B. um angebrochene Bögen aufzubrauchen. Die Etiketten werden in der gewählten Reihenfolge verteilt.</p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-3">
          <h2 className="font-display text-lg tracking-wide uppercase">Sorten wählen</h2>
          <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Sorte suchen" className="field-input" aria-label="Sorte suchen" />
          <ul className="max-h-[28rem] divide-y divide-stone-100 overflow-y-auto">
            {visible.map((t) => {
              const count = lines.find((l) => l.teaId === t.id)?.count ?? 0;
              return (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  <span className="size-5 flex-none rounded-full" style={{ background: t.color }} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{t.name}</span>
                    <span className="block truncate text-xs text-stone-500">{t.teaType}</span>
                  </span>
                  <button type="button" className="btn-secondary size-8 p-0" onClick={() => setCount(t.id, count - 1)} disabled={!count} aria-label={`${t.name} weniger`}>
                    −
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={MAX_PRINT_LABELS}
                    value={count}
                    onChange={(e) => setCount(t.id, Number(e.target.value))}
                    className="field-input w-16 px-2 py-1 text-center"
                    aria-label={`Anzahl ${t.name}`}
                  />
                  <button type="button" className="btn-secondary size-8 p-0" onClick={() => setCount(t.id, count + 1)} aria-label={`${t.name} mehr`}>
                    +
                  </button>
                </li>
              );
            })}
            {!visible.length ? <li className="py-4 text-center text-sm text-stone-500">Keine Sorte gefunden.</li> : null}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="card space-y-2">
            <h2 className="font-display text-lg tracking-wide uppercase">Auswahl</h2>
            {lines.length ? (
              <ol className="space-y-1 text-sm">
                {lines.map((l) => {
                  const t = byId.get(l.teaId);
                  return (
                    <li key={l.teaId} className="flex items-center gap-2">
                      <span className="size-3 rounded-full" style={{ background: t?.color }} aria-hidden="true" />
                      <span className="flex-1">{t?.name}</span>
                      <span className="font-semibold">{l.count} ×</span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm text-stone-500">Noch keine Sorte gewählt.</p>
            )}
          </div>
          <PrintPanel
            action="/sammeldruck.pdf"
            hiddenFields={{ items: lines.map((l) => `${l.teaId}:${l.count}`).join(","), anzahl: String(Math.max(1, total)) }}
            printers={printers}
            formats={formats}
            choice={choice}
            layout={{ count: total, start: layout.start }}
            onLayoutChange={(l) => setLayout({ count: total, start: l.start })}
            colors={firstPage}
            countEditable={false}
            disabledReason={!total ? "Bitte mindestens ein Etikett wählen." : total > MAX_PRINT_LABELS ? `Höchstens ${MAX_PRINT_LABELS} Etiketten je Druck.` : undefined}
          />
        </div>
      </div>
    </div>
  );
}
