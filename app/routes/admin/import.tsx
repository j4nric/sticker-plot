import { useEffect } from "react";
import { data, Form, useNavigation, useRevalidator } from "react-router";
import { PdfUploader } from "~/components/import/PdfUploader";
import { ReviewItem } from "~/components/import/ReviewItem";
import { Notice } from "~/components/Notice";
import { acceptImport } from "~/lib/import/accept.server";
import { importTeasFromCsv, type CsvImportReport } from "~/lib/import/csv-import.server";
import type { ImportResult } from "~/lib/import/interpret";
import { guessTeaKind } from "~/label/tea-types";
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
        kind: String(form.get("kind") ?? "") as ImportResult["kind"],
        flavored: form.get("flavored") === "on",
        description: String(form.get("description") ?? ""),
        ingredients: String(form.get("ingredients") ?? ""),
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
        // ältere Einträge kennen nur den gelesenen Text der Teeart
        const guess = item.result.kind ? { kind: item.result.kind, flavored: item.result.flavored } : guessTeaKind(item.result.teaType ?? "");
        const r = acceptImport(item.id, { ...item.result, kind: guess?.kind ?? "", flavored: guess?.flavored ?? false });
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
      {actionData?.message ? <Notice>{actionData.message}</Notice> : null}
      {actionData?.error && !actionData.itemId ? <p className="field-error">{actionData.error}</p> : null}

      <PdfUploader />

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
          Tees als CSV exportieren, in Excel bearbeiten und wieder importieren. Erste Zeile mit Spaltennamen, mindestens „name“. Weitere Spalten: titel, teeart (z. B. „Aromatisierter Schwarztee“),
          beschreibung, zutaten, motiv, vorlage, menge, temperatur, ziehzeit, bio, ean, link, preis, haltbarkeit_monate.
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
