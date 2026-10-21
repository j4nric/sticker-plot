import { Link, useFetcher } from "react-router";
import type { ImportItem } from "~/db/schema";
import type { ImportResult } from "~/lib/import/interpret";

export interface ReviewItemData {
  id: number;
  fileName: string;
  status: ImportItem["status"];
  error: string;
  result: ImportResult | null;
  duplicate: { id: number; name: string } | null;
}

function Confidence({ value }: { value: number }) {
  const color = value >= 85 ? "bg-brand-100 text-brand-800" : value >= 65 ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-800";
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${color}`}>{value} %</span>;
}

export function ReviewItem({ item }: { item: ReviewItemData }) {
  const fetcher = useFetcher<{ error?: string }>();
  const r = item.result;
  const busy = fetcher.state !== "idle";
  const err = fetcher.data?.error;

  if (item.status === "queued" || item.status === "processing") {
    return (
      <li className="card flex items-center gap-3 text-sm">
        <span className="size-3 animate-pulse rounded-full bg-brand-600" aria-hidden="true" />
        <span className="flex-1 font-mono text-xs">{item.fileName}</span>
        <span className="text-stone-500">{item.status === "processing" ? "wird gelesen …" : "wartet"}</span>
      </li>
    );
  }
  if (item.status === "error" || !r) {
    return (
      <li className="card flex flex-wrap items-center gap-3 border-red-200 text-sm">
        <span className="flex-1">
          <span className="block font-mono text-xs">{item.fileName}</span>
          <span className="text-red-700">{item.error || "Fehler"}</span>
        </span>
        <fetcher.Form method="post" className="flex gap-2">
          <input type="hidden" name="id" value={item.id} />
          <button className="btn-secondary" name="intent" value="retry" disabled={busy}>
            Erneut versuchen
          </button>
          <button className="btn-danger" name="intent" value="skip" disabled={busy}>
            Verwerfen
          </button>
        </fetcher.Form>
      </li>
    );
  }
  return (
    <li className="card">
      <fetcher.Form method="post" className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
        <input type="hidden" name="id" value={item.id} />
        <div className="space-y-2">
          <img src={`/verwaltung/import/${item.id}/vorschau.png`} alt={`Erkanntes Etikett aus ${item.fileName}`} className="w-40 rounded border border-stone-200" loading="lazy" />
          <p className="font-mono text-[11px] break-all text-stone-500">{item.fileName}</p>
        </div>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div>
              <label className="field-label flex items-center gap-2" htmlFor={`n-${item.id}`}>
                Name <Confidence value={r.confidence.name} />
              </label>
              <input id={`n-${item.id}`} name="name" defaultValue={r.name} required maxLength={80} className="field-input" />
              {r.fileNameGuess && r.fileNameGuess !== r.name ? <p className="field-hint">Laut Dateiname: {r.fileNameGuess}</p> : null}
            </div>
            <div>
              <label className="field-label flex items-center gap-2" htmlFor={`t-${item.id}`}>
                Teeart <Confidence value={r.confidence.teaType} />
              </label>
              <input id={`t-${item.id}`} name="teaType" defaultValue={r.teaType} maxLength={40} className="field-input" />
            </div>
            <div>
              <label className="field-label" htmlFor={`c-${item.id}`}>
                Farbe
              </label>
              <input id={`c-${item.id}`} name="color" type="color" defaultValue={r.color} className="h-10 w-14 rounded border border-stone-300 bg-white p-1" />
            </div>
          </div>
          <div>
            <label className="field-label flex items-center gap-2" htmlFor={`d-${item.id}`}>
              Beschreibung <Confidence value={r.confidence.description} />
            </label>
            <textarea id={`d-${item.id}`} name="description" defaultValue={r.description} rows={4} className="field-input" />
          </div>
          <div>
            <label className="field-label" htmlFor={`i-${item.id}`}>
              Zutaten
            </label>
            <input id={`i-${item.id}`} name="ingredients" defaultValue={r.ingredients} maxLength={1000} className="field-input" placeholder="auf alten Etiketten meist nicht vorhanden" />
          </div>
          {r.warnings.length ? (
            <ul className="list-inside list-disc text-sm text-amber-800">
              {r.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          {item.duplicate ? (
            <p className="text-sm text-amber-800">
              Es gibt schon eine Sorte „<Link to={`/tees/${item.duplicate.id}`} className="underline">{item.duplicate.name}</Link>“.
              <label className="ml-2 inline-flex items-center gap-1">
                <input type="checkbox" name="allowDuplicate" value="1" /> trotzdem zusätzlich anlegen
              </label>
            </p>
          ) : null}
          {err ? <p className="field-error">{err}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" name="intent" value="accept" disabled={busy}>
              Übernehmen
            </button>
            <button className="btn-danger" name="intent" value="skip" disabled={busy} formNoValidate>
              Verwerfen
            </button>
          </div>
        </div>
      </fetcher.Form>
    </li>
  );
}
