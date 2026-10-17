import { useEffect, useRef, useState } from "react";
import { data, Form, Link, useFetcher, useNavigation, useRevalidator } from "react-router";
import { acceptImport } from "~/lib/import/accept.server";
import { importTeasFromCsv, type CsvImportReport } from "~/lib/import/csv-import.server";
import type { ImportResult } from "~/lib/import/interpret";
import { kickQueue } from "~/lib/import/queue.server";
import { currentUser } from "~/lib/session.server";
import { audit } from "~/models/audit.server";
import { clearFinished, importCounts, listImportItems, retryItem, setItemStatus } from "~/models/import.server";
import { findTeaByName } from "~/models/tea.server";
import type { Route } from "./+types/import";

export function meta() {
  return [{ title: "Import · Tee-Etiketten" }];
}

export function loader() {
  void kickQueue();
  const items = listImportItems({ open: true }).map((i) => {
    const dup = i.result?.name ? findTeaByName(i.result.name) : undefined;
    return { ...i, duplicate: dup ? { id: dup.id, name: dup.name } : null };
  });
  return { items, counts: importCounts() };
}

type ActionResult = { message?: string; error?: string; itemId?: number; csv?: CsvImportReport };

export async function action({ request, context }: Route.ActionArgs) {
  const user = currentUser(context);
  const form = await request.formData();
  const intent = form.get("intent");
  const id = Number(form.get("id"));

  switch (intent) {
    case "accept": {
      const fields = {
        name: String(form.get("name") ?? ""),
        teaType: String(form.get("teaType") ?? ""),
        description: String(form.get("description") ?? ""),
        ingredients: String(form.get("ingredients") ?? ""),
        color: String(form.get("color") ?? ""),
      };
      const r = acceptImport(id, fields, { allowDuplicate: form.get("allowDuplicate") === "1" });
      if (!r.ok) return data<ActionResult>({ error: r.error, itemId: id }, { status: 400 });
      audit(user.username, "import übernehmen", "tee", r.teaId, fields.name);
      return { message: `„${fields.name}“ übernommen.` } as ActionResult;
    }
    case "accept-all": {
      let ok = 0;
      let skipped = 0;
      for (const item of listImportItems({ open: true })) {
        if (item.status !== "done" || !item.result) continue;
        if (form.get("onlyClean") === "1" && item.result.warnings.length) {
          skipped++;
          continue;
        }
        const r = acceptImport(item.id, item.result);
        if (r.ok) ok++;
        else skipped++;
      }
      audit(user.username, "import übernehmen", "tee", null, `${ok} Sorten auf einmal`);
      return { message: `${ok} Sorten übernommen${skipped ? `, ${skipped} übersprungen (Warnungen, doppelte Namen oder Fehler)` : ""}.` } as ActionResult;
    }
    case "skip":
      setItemStatus(id, { status: "skipped", clearSource: true });
      return { message: "Verworfen." } as ActionResult;
    case "retry":
      retryItem(id);
      void kickQueue();
      return { message: "Wird erneut gelesen." } as ActionResult;
    case "clear":
      clearFinished();
      return { message: "Erledigte Einträge entfernt." } as ActionResult;
    case "csv": {
      const file = form.get("csv");
      if (!(file instanceof File) || file.size === 0) return data<ActionResult>({ error: "Bitte eine CSV-Datei auswählen." }, { status: 400 });
      if (file.size > 10 * 1024 * 1024) return data<ActionResult>({ error: "Die CSV-Datei ist größer als 10 MB." }, { status: 400 });
      const report = importTeasFromCsv(await file.text(), form.get("mode") === "upsert" ? "upsert" : "create");
      audit(user.username, "csv import", "tee", null, `${report.created} neu, ${report.updated} aktualisiert, ${report.errors.length} Fehler`);
      return { csv: report } as ActionResult;
    }
    default:
      throw data("Unbekannte Aktion", { status: 400 });
  }
}

function Uploader() {
  const [progress, setProgress] = useState<{ done: number; total: number; errors: string[] } | null>(null);
  const revalidator = useRevalidator();
  const input = useRef<HTMLInputElement>(null);

  async function upload(files: FileList) {
    const list = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    const errors: string[] = [];
    setProgress({ done: 0, total: list.length, errors });
    for (let i = 0; i < list.length; i++) {
      const body = new FormData();
      body.set("pdf", list[i]!);
      try {
        const res = await fetch("/verwaltung/import/status", { method: "POST", body });
        if (!res.ok) errors.push(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `${list[i]!.name}: Fehler ${res.status}`);
      } catch {
        errors.push(`${list[i]!.name}: Verbindung unterbrochen`);
      }
      setProgress({ done: i + 1, total: list.length, errors: [...errors] });
      if (i % 5 === 4) revalidator.revalidate();
    }
    if (input.current) input.current.value = "";
    revalidator.revalidate();
  }

  return (
    <section className="card space-y-3">
      <h2 className="font-display text-lg tracking-wide uppercase">Alte Etiketten (PDF) übernehmen</h2>
      <p className="text-sm text-stone-700">
        PDFs aus Photoshop auswählen, gern alle auf einmal. Die App liest auf dem ersten Etikett jedes Bogens Name, Teeart, Beschreibung und Tassenfarbe per
        Texterkennung. Danach erscheinen die Ergebnisse unten zur Prüfung. Pro Datei dauert das einige Sekunden.
      </p>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="text-sm"
        onChange={(e) => e.target.files?.length && upload(e.target.files)}
        disabled={Boolean(progress && progress.done < progress.total)}
        aria-label="PDF-Dateien auswählen"
      />
      {progress ? (
        <div className="space-y-1 text-sm">
          <p>
            {progress.done} von {progress.total} Dateien hochgeladen
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
            <div className="h-full bg-brand-600" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
          {progress.errors.map((e) => (
            <p key={e} className="field-error">
              {e}
            </p>
          ))}
        </div>
      ) : null}
      <p className="field-hint">
        Für sehr viele Dateien gibt es zusätzlich ein Kommandozeilen-Werkzeug auf dem Server, siehe Dokumentation „Import“.
      </p>
    </section>
  );
}

type Item = Route.ComponentProps["loaderData"]["items"][number];

function Confidence({ value }: { value: number }) {
  const color = value >= 85 ? "bg-brand-100 text-brand-800" : value >= 65 ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-800";
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${color}`}>{value} %</span>;
}

function ReviewItem({ item }: { item: Item }) {
  const fetcher = useFetcher<ActionResult>();
  const r = item.result as ImportResult | null;
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

export default function Import({ loaderData, actionData }: Route.ComponentProps) {
  const { items, counts } = loaderData;
  const revalidator = useRevalidator();
  const busy = useNavigation().state !== "idle";
  const pending = (counts.queued ?? 0) + (counts.processing ?? 0);
  const ready = counts.done ?? 0;

  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => revalidator.state === "idle" && revalidator.revalidate(), 2500);
    return () => clearInterval(t);
  }, [pending, revalidator]);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl tracking-wide uppercase">Import</h1>
      {actionData?.message ? <p className="rounded-lg bg-brand-50 px-4 py-2 text-brand-800">{actionData.message}</p> : null}
      {actionData?.error && !actionData.itemId ? <p className="field-error">{actionData.error}</p> : null}

      <Uploader />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-lg tracking-wide uppercase">Zur Prüfung</h2>
          <span className="text-sm text-stone-600">
            {ready} bereit{pending ? ` · ${pending} in Arbeit` : ""}
            {counts.error ? ` · ${counts.error} mit Fehler` : ""}
            {counts.imported ? ` · ${counts.imported} übernommen` : ""}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            {ready ? (
              <>
                <Form method="post">
                  <input type="hidden" name="onlyClean" value="1" />
                  <button className="btn-secondary" name="intent" value="accept-all" disabled={busy}>
                    Alle ohne Warnung übernehmen
                  </button>
                </Form>
                <Form method="post" onSubmit={(e) => !confirm(`Alle ${ready} erkannten Sorten ungeprüft übernehmen? Doppelte Namen werden übersprungen.`) && e.preventDefault()}>
                  <button className="btn-secondary" name="intent" value="accept-all" disabled={busy}>
                    Alle übernehmen
                  </button>
                </Form>
              </>
            ) : null}
            {counts.imported || counts.skipped ? (
              <Form method="post">
                <button className="btn-secondary" name="intent" value="clear" disabled={busy}>
                  Erledigte entfernen
                </button>
              </Form>
            ) : null}
          </div>
        </div>
        {items.length ? (
          <ul className="space-y-3">
            {items.map((item) => (
              <ReviewItem key={item.id} item={item} />
            ))}
          </ul>
        ) : (
          <p className="card text-sm text-stone-500">Keine offenen Einträge.</p>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-lg tracking-wide uppercase">CSV oder Excel</h2>
        <p className="text-sm text-stone-700">
          Tees als CSV exportieren, in Excel bearbeiten und wieder importieren. Erste Zeile mit Spaltennamen, mindestens „name“. Weitere Spalten: teeart,
          beschreibung, zutaten, farbe, motiv, vorlage, menge, temperatur, ziehzeit, bio, ean, link, preis, haltbarkeit_monate.
        </p>
        <a href="/verwaltung/export.csv" className="btn-secondary">
          Alle Tees als CSV herunterladen
        </a>
        <Form method="post" encType="multipart/form-data" className="flex flex-wrap items-end gap-3">
          <input type="file" name="csv" accept=".csv,text/csv" required className="text-sm" />
          <select name="mode" className="field-input w-auto" aria-label="Verhalten bei vorhandenen Namen">
            <option value="create">Nur neue Sorten anlegen</option>
            <option value="upsert">Neue anlegen, vorhandene (gleicher Name) aktualisieren</option>
          </select>
          <button className="btn-primary" name="intent" value="csv" disabled={busy}>
            CSV importieren
          </button>
        </Form>
        {actionData?.csv ? (
          <div className="rounded-lg bg-stone-50 p-3 text-sm">
            <p>
              {actionData.csv.created} neu angelegt, {actionData.csv.updated} aktualisiert, {actionData.csv.skipped} übersprungen.
            </p>
            {actionData.csv.errors.length ? (
              <ul className="mt-2 list-inside list-disc text-red-700">
                {actionData.csv.errors.slice(0, 50).map((e) => (
                  <li key={`${e.row}-${e.message}`}>
                    Zeile {e.row}
                    {e.name ? ` (${e.name})` : ""}: {e.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
