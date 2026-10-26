import { useState } from "react";
import { data, Form, Link, redirect, useFetcher, useSearchParams } from "react-router";
import { PrintPanel } from "~/components/PrintPanel";
import { useDeviceChoice } from "~/components/useDeviceChoice";
import { TeaEditor } from "~/components/TeaEditor";
import { editorData, rawToForm, teaToForm } from "~/lib/editor.server";
import { currentUser } from "~/lib/session.server";
import { readTeaForm } from "~/lib/validation";
import { labelsPerSheet, type PrintLayout } from "~/label/geometry";
import { audit } from "~/models/audit.server";
import { archiveTea, deleteTea, duplicateTea, getTea, lastPrintJobs, updateTea } from "~/models/tea.server";
import { formatDateTime } from "~/lib/locale";
import { parseId } from "~/lib/params";
import { Notice } from "~/components/Notice";
import type { Route } from "./+types/tea-edit";

const teaIdFrom = (params: { teaId: string }) => parseId(params.teaId);

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.tea.name ?? "Tee"} · Tee-Etiketten` }];
}

export function loader({ params, context }: Route.LoaderArgs) {
  const user = currentUser(context);
  const tea = getTea(teaIdFrom(params));
  if (!tea) throw data("Tee nicht gefunden", { status: 404 });
  const d = editorData();
  const printerNames = new Map(d.printers.map((p) => [p.id, p.name]));
  const jobs = lastPrintJobs(tea.id).map((j) => ({
    id: j.id,
    createdAt: j.createdAt,
    labelCount: j.labelCount,
    userName: j.userName,
    printer: j.printerId ? (printerNames.get(j.printerId) ?? "gelöschter Drucker") : "gelöschter Drucker",
  }));
  return {
    tea: { id: tea.id, name: tea.name, archivedAt: tea.archivedAt, updatedAt: tea.updatedAt, shelfLifeMonths: tea.shelfLifeMonths, color: tea.color, teaType: tea.teaType },
    form: teaToForm(tea),
    imageSrc: tea.imageId ? `/bilder/${tea.imageId}` : null,
    jobs,
    isAdmin: user.role === "admin",
    ...d,
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const user = currentUser(context);
  const id = teaIdFrom(params);
  const tea = getTea(id);
  if (!tea) throw data("Tee nicht gefunden", { status: 404 });
  const form = await request.formData();
  switch (form.get("intent")) {
    case "duplicate": {
      const copy = duplicateTea(id)!;
      audit(user.username, "duplizieren", "tee", copy.id, `${tea.name} → ${copy.name}`);
      throw redirect(`/tees/${copy.id}?kopie=1`);
    }
    case "archive":
      archiveTea(id, true);
      audit(user.username, "archivieren", "tee", id, tea.name);
      throw redirect("/");
    case "restore":
      archiveTea(id, false);
      audit(user.username, "wiederherstellen", "tee", id, tea.name);
      return { errors: undefined, values: undefined, saved: false, message: "Tee wiederhergestellt." };
    case "delete":
      if (user.role !== "admin") throw data("Nur Administratoren dürfen endgültig löschen.", { status: 403 });
      if (!tea.archivedAt) throw data("Nur archivierte Tees können endgültig gelöscht werden.", { status: 400 });
      deleteTea(id);
      audit(user.username, "löschen", "tee", id, tea.name);
      throw redirect("/?archiv=1");
    default: {
      const parsed = readTeaForm(form);
      if (!parsed.ok) return data({ errors: parsed.errors, values: rawToForm(parsed.raw), saved: false, message: undefined }, { status: 400 });
      updateTea(id, parsed.value);
      audit(user.username, "ändern", "tee", id, parsed.value.name);
      return { errors: undefined, values: undefined, saved: true, message: undefined };
    }
  }
}

function ImageUpload({ teaId, imageSrc }: { teaId: number; imageSrc: string | null }) {
  const fetcher = useFetcher<{ error?: string }>();
  const busy = fetcher.state !== "idle";
  return (
    <div className="card space-y-3">
      <h2 className="font-display text-lg tracking-wide uppercase">Eigenes Bild</h2>
      <p className="text-sm text-stone-600">Ersetzt das Motiv oben auf dem Etikett. PNG, JPG, WebP oder SVG bis 3 MB, am besten mit transparentem Hintergrund.</p>
      <div className="flex flex-wrap items-center gap-4">
        {imageSrc ? <img src={imageSrc} alt="Aktuelles Bild" className="h-16 w-16 rounded border border-stone-200 object-contain" /> : null}
        <fetcher.Form method="post" action={`/tees/${teaId}/bild`} encType="multipart/form-data" className="flex flex-wrap items-center gap-2">
          <input type="file" name="bild" accept="image/png,image/jpeg,image/webp,image/svg+xml" required className="text-sm" />
          <button className="btn-secondary" name="intent" value="upload" disabled={busy}>
            {busy ? "Lädt …" : "Hochladen"}
          </button>
        </fetcher.Form>
        {imageSrc ? (
          <fetcher.Form method="post" action={`/tees/${teaId}/bild`}>
            <button className="btn-danger" name="intent" value="remove" disabled={busy}>
              Bild entfernen
            </button>
          </fetcher.Form>
        ) : null}
      </div>
      {fetcher.data?.error ? <p className="field-error">{fetcher.data.error}</p> : null}
    </div>
  );
}

export default function EditTea({ loaderData, actionData }: Route.ComponentProps) {
  const { tea, form, imageSrc, jobs, shop, kinds, templates, formats, printers, isAdmin } = loaderData;
  const [params] = useSearchParams();
  const choice = useDeviceChoice(printers, formats);
  const [layout, setLayout] = useState<PrintLayout>({ count: labelsPerSheet(choice.format), start: Math.min(choice.printer.nextSlot, labelsPerSheet(choice.format)) });
  const archived = Boolean(tea.archivedAt);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to={archived ? "/?archiv=1" : "/"} className="text-sm text-stone-600 hover:text-stone-900">
          ‹ {archived ? "Archiv" : "Alle Tees"}
        </Link>
        <h1 className="flex w-full flex-wrap items-center gap-3 font-display text-3xl tracking-wide uppercase">
          {tea.name}
          {archived ? <span className="rounded-full bg-stone-200 px-2 py-0.5 font-sans text-xs tracking-normal text-stone-700 normal-case">archiviert</span> : null}
        </h1>
      </div>
      {params.get("neu") && !actionData ? <Notice>Tee angelegt. Jetzt kannst du Etiketten drucken.</Notice> : null}
      {params.get("kopie") && !actionData ? <Notice>Kopie angelegt. Bitte Namen und Texte anpassen.</Notice> : null}
      {actionData?.saved ? <Notice>Änderungen gespeichert.</Notice> : null}
      {actionData?.message ? <Notice>{actionData.message}</Notice> : null}

      {archived ? (
        <div className="card flex flex-wrap items-center gap-3 border-amber-300 bg-amber-50">
          <p className="flex-1 text-amber-900">Dieser Tee ist archiviert und erscheint nicht in der Liste.</p>
          <Form method="post">
            <button className="btn-secondary" name="intent" value="restore">
              Wiederherstellen
            </button>
          </Form>
          {isAdmin ? (
            <Form method="post" onSubmit={(e) => !confirm(`„${tea.name}“ endgültig löschen? Das kann nicht rückgängig gemacht werden.`) && e.preventDefault()}>
              <button className="btn-danger" name="intent" value="delete">
                Endgültig löschen
              </button>
            </Form>
          ) : null}
        </div>
      ) : null}

      <TeaEditor
        key={`${tea.id}-${new Date(tea.updatedAt).valueOf()}-${imageSrc}-${form.motif}`}
        initial={actionData?.values ?? form}
        errors={actionData?.errors}
        shop={shop}
        kinds={kinds}
        legacyTeaType={tea.teaType}
        legacyColor={tea.color}
        templates={templates}
        format={choice.format}
        imageSrc={imageSrc}
        isNew={false}
        printLayout={layout}
        formActions={
          <span className="ml-auto flex gap-2">
            <button form="tea-actions" name="intent" value="duplicate" className="btn-secondary">
              Duplizieren
            </button>
            {!archived ? (
              <button form="tea-actions" name="intent" value="archive" className="btn-danger" onClick={(e) => !confirm(`„${tea.name}“ ins Archiv verschieben?`) && e.preventDefault()}>
                Archivieren
              </button>
            ) : null}
          </span>
        }
        imageSlot={<ImageUpload teaId={tea.id} imageSrc={imageSrc} />}
        renderAside={({ dirty }) => (
          <>
            <PrintPanel
              action={`/tees/${tea.id}/etiketten.pdf`}
              printers={printers}
              formats={formats}
              choice={choice}
              layout={layout}
              onLayoutChange={setLayout}
              shelfLifeMonths={tea.shelfLifeMonths}
              disabledReason={dirty ? "Bitte zuerst die Änderungen speichern." : archived ? "Archivierte Tees zuerst wiederherstellen." : undefined}
            />
            {jobs.length ? (
              <div className="card">
                <h2 className="mb-2 text-sm font-semibold text-stone-700">Zuletzt gedruckt</h2>
                <ul className="space-y-1 text-sm text-stone-600">
                  {jobs.map((j) => (
                    <li key={j.id}>
                      {formatDateTime(j.createdAt)} · {j.labelCount} Etiketten · {j.printer}
                      {j.userName ? ` · ${j.userName}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      />
      <Form method="post" id="tea-actions" className="hidden" />
    </div>
  );
}
