import { useState } from "react";
import { data, Form, Link, redirect, useSearchParams } from "react-router";
import { PrintPanel } from "~/components/PrintPanel";
import { TeaEditor, type PrintLayout } from "~/components/TeaEditor";
import { env } from "~/lib/env.server";
import { readTeaForm } from "~/lib/validation";
import { LABELS_PER_SHEET } from "~/label/geometry";
import { listPrinters } from "~/models/printer.server";
import { deleteTea, getTea, lastPrintJobs, updateTea } from "~/models/tea.server";
import type { Route } from "./+types/tea-edit";

function teaIdFrom(params: { teaId: string }) {
  const id = Number(params.teaId);
  if (!Number.isInteger(id) || id <= 0) throw data("Tee nicht gefunden", { status: 404 });
  return id;
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.tea.name ?? "Tee"} · Tee-Etiketten` }];
}

export function loader({ params }: Route.LoaderArgs) {
  const tea = getTea(teaIdFrom(params));
  if (!tea) throw data("Tee nicht gefunden", { status: 404 });
  const printers = listPrinters().map((p) => ({ id: p.id, name: p.name, isDefault: p.isDefault }));
  const printerNames = new Map(printers.map((p) => [p.id, p.name]));
  const jobs = lastPrintJobs(tea.id).map((j) => ({
    id: j.id,
    createdAt: j.createdAt,
    labelCount: j.labelCount,
    printer: j.printerId ? (printerNames.get(j.printerId) ?? "gelöschter Drucker") : "gelöschter Drucker",
  }));
  return { tea, printers, jobs, shop: env.shop };
}

export async function action({ request, params }: Route.ActionArgs) {
  const id = teaIdFrom(params);
  const form = await request.formData();
  if (form.get("intent") === "delete") {
    deleteTea(id);
    throw redirect("/");
  }
  const parsed = readTeaForm(form);
  if (!parsed.ok) return data({ errors: parsed.errors, saved: false }, { status: 400 });
  if (!getTea(id)) throw data("Tee nicht gefunden", { status: 404 });
  updateTea(id, parsed.value);
  return { errors: undefined, saved: true };
}

const dateTimeFmt = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

export default function EditTea({ loaderData, actionData }: Route.ComponentProps) {
  const { tea, printers, jobs, shop } = loaderData;
  const [params] = useSearchParams();
  const [layout, setLayout] = useState<PrintLayout>({ count: LABELS_PER_SHEET, start: 1 });
  const initial = { name: tea.name, teaType: tea.teaType, description: tea.description, ingredients: tea.ingredients, color: tea.color };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/" className="text-sm text-stone-600 hover:text-stone-900">
          ‹ Alle Tees
        </Link>
        <h1 className="w-full font-display text-3xl tracking-wide uppercase">{tea.name}</h1>
      </div>
      {params.get("neu") && !actionData ? <p className="rounded-lg bg-brand-50 px-4 py-2 text-brand-800">Tee angelegt. Jetzt kannst du Etiketten drucken.</p> : null}
      {actionData?.saved ? <p className="rounded-lg bg-brand-50 px-4 py-2 text-brand-800">Änderungen gespeichert.</p> : null}

      <TeaEditor
        key={`${tea.id}-${tea.updatedAt.valueOf()}`}
        initial={initial}
        errors={actionData?.errors}
        shop={shop}
        isNew={false}
        printLayout={layout}
        formActions={
          <button
            form="delete-tea"
            className="btn-danger ml-auto"
            onClick={(e) => {
              if (!confirm(`„${tea.name}“ wirklich löschen?`)) e.preventDefault();
            }}
          >
            Löschen
          </button>
        }
        renderAside={({ dirty }) => (
          <>
            <PrintPanel
              teaId={tea.id}
              printers={printers}
              layout={layout}
              onLayoutChange={setLayout}
              disabledReason={dirty ? "Bitte zuerst die Änderungen speichern." : undefined}
            />
            {jobs.length ? (
              <div className="card">
                <h2 className="mb-2 text-sm font-semibold text-stone-700">Zuletzt gedruckt</h2>
                <ul className="space-y-1 text-sm text-stone-600">
                  {jobs.map((j) => (
                    <li key={j.id}>
                      {dateTimeFmt.format(j.createdAt)} · {j.labelCount} Etiketten · {j.printer}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      />
      <Form method="post" id="delete-tea" className="hidden">
        <input type="hidden" name="intent" value="delete" />
      </Form>
    </div>
  );
}
