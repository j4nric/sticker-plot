import { useState } from "react";
import { data, Form, Link, redirect } from "react-router";
import { DEFAULT_SHEET, GEOMETRY_FIELDS, labelsPerSheet, slotPosition, validateGeometry, type SheetGeometry } from "~/label/geometry";
import { currentUser } from "~/lib/session.server";
import { parseDecimal } from "~/lib/locale";
import { readGeometry } from "~/lib/validation";
import { audit } from "~/models/audit.server";
import { deleteFormat, getFormat, listFormats, saveFormat, setDefaultFormat } from "~/models/format.server";
import { parseId } from "~/lib/params";
import { Notice } from "~/components/Notice";
import type { Route } from "./+types/format-edit";

export function meta() {
  return [{ title: "Bogenformat · Tee-Etiketten" }];
}

export function loader({ params }: Route.LoaderArgs) {
  if (params.formatId === "neu") return { format: { id: null, name: "", isDefault: false, ...DEFAULT_SHEET }, count: listFormats().length };
  const format = getFormat(parseId(params.formatId));
  if (!format) throw data("Format nicht gefunden", { status: 404 });
  return { format, count: listFormats().length };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const user = currentUser(context);
  const id = params.formatId === "neu" ? null : parseId(params.formatId);
  const form = await request.formData();
  const intent = form.get("intent");
  if (id && intent === "default") {
    setDefaultFormat(id);
    audit(user.username, "als standard setzen", "bogenformat", id);
    return { errors: [], saved: true };
  }
  if (id && intent === "delete") {
    if (!deleteFormat(id)) return data({ errors: ["Das letzte Format kann nicht gelöscht werden."], saved: false }, { status: 400 });
    audit(user.username, "löschen", "bogenformat", id);
    throw redirect("/verwaltung/bogenformate");
  }
  const { name, geometry, errors } = readGeometry(form);
  if (errors.length) return data({ errors, saved: false }, { status: 400 });
  const saved = saveFormat(id, name, geometry);
  audit(user.username, id ? "ändern" : "anlegen", "bogenformat", saved.id, name);
  if (!id) throw redirect(`/verwaltung/bogenformate/${saved.id}`);
  return { errors: [], saved: true };
}

const LABELS: Record<(typeof GEOMETRY_FIELDS)[number], string> = {
  pageWidth: "Seitenbreite (mm)",
  pageHeight: "Seitenhöhe (mm)",
  columns: "Spalten",
  rows: "Zeilen",
  labelWidth: "Etikettbreite (mm)",
  labelHeight: "Etiketthöhe (mm)",
  originX: "Erstes Etikett: Abstand links (mm)",
  originY: "Erstes Etikett: Abstand oben (mm)",
  pitchX: "Raster waagerecht (mm)",
  pitchY: "Raster senkrecht (mm)",
};
const HINTS: Partial<Record<(typeof GEOMETRY_FIELDS)[number], string>> = {
  pitchX: "Abstand von linker Kante zu linker Kante zweier Nachbarn",
  pitchY: "Abstand von oberer Kante zu oberer Kante",
};

function SheetSketch({ g }: { g: SheetGeometry }) {
  const scale = 380 / Math.max(g.pageWidth, g.pageHeight);
  const ok = validateGeometry(g).length === 0;
  return (
    <svg viewBox={`0 0 ${g.pageWidth} ${g.pageHeight}`} style={{ width: g.pageWidth * scale, height: g.pageHeight * scale }} className="max-w-full rounded border border-stone-300 bg-white">
      {ok
        ? Array.from({ length: labelsPerSheet(g) }, (_, i) => {
            const p = slotPosition(i, g);
            return <rect key={i} x={p.x} y={p.y} width={g.labelWidth} height={g.labelHeight} rx={1} fill="#e0efd9" stroke="#3f7f32" strokeWidth={0.4} />;
          })
        : null}
    </svg>
  );
}

export default function FormatEdit({ loaderData, actionData }: Route.ComponentProps) {
  const { format, count } = loaderData;
  const [g, setG] = useState<SheetGeometry>(format);
  const live = validateGeometry(g);
  return (
    <div className="space-y-5">
      <Link to="/verwaltung/bogenformate" className="text-sm text-stone-600 hover:text-stone-900">
        ‹ Alle Formate
      </Link>
      <h1 className="font-display text-3xl tracking-wide uppercase">{format.id ? format.name : "Neues Bogenformat"}</h1>
      {actionData?.saved ? <Notice>Gespeichert.</Notice> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <Form method="post" className="card space-y-4">
          <div>
            <label className="field-label" htmlFor="name">
              Name
            </label>
            <input id="name" name="name" defaultValue={format.name} required maxLength={60} placeholder="z. B. A4 quer, 6 × 2" className="field-input" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {GEOMETRY_FIELDS.map((f) => (
              <div key={f}>
                <label className="field-label" htmlFor={f}>
                  {LABELS[f]}
                </label>
                <input
                  id={f}
                  name={f}
                  inputMode="decimal"
                  defaultValue={String(format[f]).replace(".", ",")}
                  onChange={(e) => {
                    const v = parseDecimal(e.target.value);
                    if (v !== null) setG((old) => ({ ...old, [f]: v }));
                  }}
                  className="field-input"
                />
                {HINTS[f] ? <p className="field-hint">{HINTS[f]}</p> : null}
              </div>
            ))}
          </div>
          {(actionData?.errors?.length ? actionData.errors : live).map((e) => (
            <p key={e} className="field-error">
              {e}
            </p>
          ))}
          <button className="btn-primary">{format.id ? "Speichern" : "Format anlegen"}</button>
        </Form>
        <div className="space-y-4">
          <div className="card space-y-3">
            <h2 className="font-display text-lg tracking-wide uppercase">Vorschau</h2>
            <SheetSketch g={g} />
            <p className="text-sm text-stone-600">{labelsPerSheet(g)} Etiketten pro Bogen. Danach mit dem Testbogen beim Drucker prüfen und kalibrieren.</p>
          </div>
          {format.id ? (
            <div className="card flex flex-wrap gap-3">
              {!format.isDefault ? (
                <Form method="post">
                  <button className="btn-secondary" name="intent" value="default">
                    Als Standard verwenden
                  </button>
                </Form>
              ) : null}
              {count > 1 ? (
                <Form method="post" onSubmit={(e) => !confirm("Format löschen?") && e.preventDefault()}>
                  <button className="btn-danger" name="intent" value="delete">
                    Löschen
                  </button>
                </Form>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
