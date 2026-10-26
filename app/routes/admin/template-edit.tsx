import { useState } from "react";
import { data, Form, Link, redirect } from "react-router";
import { FitMeter, FittedPreview, type FitReport } from "~/components/FittedPreview";
import { Label, type LabelContent } from "~/label/Label";
import { DEFAULT_TEMPLATE_PARAMS, FONTS, normalizeParams, PARAM_LIMITS, VARIANT_PRESETS, VARIANTS, type TemplateParams, type Variant } from "~/label/template";
import { currentUser } from "~/lib/session.server";
import { readTemplateForm } from "~/lib/validation";
import { audit } from "~/models/audit.server";
import { listFormats } from "~/models/format.server";
import { getKindSettings, getSettings } from "~/models/settings.server";
import { allTeas, previewLabelContent } from "~/models/tea.server";
import { deleteTemplate, getTemplate, listTemplates, saveTemplate, setDefaultTemplate } from "~/models/template.server";
import { formatCompact } from "~/lib/locale";
import { parseId } from "~/lib/params";
import { Notice } from "~/components/Notice";
import { TEA_KINDS } from "~/label/tea-types";
import type { Route } from "./+types/template-edit";

export function meta() {
  return [{ title: "Vorlage · Tee-Etiketten" }];
}

const SAMPLE: LabelContent = {
  name: "China Sencha",
  teaType: "Aromatisierter Grüntee",
  kind: "gruen",
  description:
    "Ein Grüntee mit mittelgrünem, flachgepresstem Blatt und einer feinherben, leicht heuigen Note, der in Asien besonders beliebt ist und einen hellgelben, duftigen Aufguss bietet.",
  ingredients: "Grüner Tee (China)",
  color: TEA_KINDS.gruen.color,
  brewAmount: "1 TL / 250 ml",
  brewTemp: 80,
  brewTime: "2–3 Min.",
};

export function loader({ params }: Route.LoaderArgs) {
  const isNew = params.templateId === "neu";
  const template = isNew ? null : getTemplate(parseId(params.templateId));
  if (!isNew && !template) throw data("Vorlage nicht gefunden", { status: 404 });
  const kinds = getKindSettings();
  const samples = [
    { id: 0, label: "Beispiel: China Sencha", content: SAMPLE },
    ...allTeas()
      .filter((t) => !t.archivedAt)
      .slice(0, 200)
      .map((t) => ({ id: t.id, label: t.name, content: previewLabelContent(t, kinds) })),
  ];
  return {
    template: template ?? { id: null, name: "", isDefault: false, params: DEFAULT_TEMPLATE_PARAMS },
    count: listTemplates().length,
    shop: getSettings().shop,
    format: listFormats()[0]!,
    samples,
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const user = currentUser(context);
  const id = params.templateId === "neu" ? null : parseId(params.templateId);
  const form = await request.formData();
  const intent = form.get("intent");
  if (id && intent === "default") {
    setDefaultTemplate(id);
    audit(user.username, "als standard setzen", "vorlage", id);
    return { errors: [] as string[], saved: true };
  }
  if (id && intent === "delete") {
    if (!deleteTemplate(id)) return data({ errors: ["Die letzte Vorlage kann nicht gelöscht werden."], saved: false }, { status: 400 });
    audit(user.username, "löschen", "vorlage", id);
    throw redirect("/verwaltung/vorlagen");
  }
  const { name, params: p, errors } = readTemplateForm(form);
  if (errors.length) return data({ errors, saved: false }, { status: 400 });
  const saved = saveTemplate(id, name, p);
  audit(user.username, id ? "ändern" : "anlegen", "vorlage", saved.id, name);
  if (!id) throw redirect(`/verwaltung/vorlagen/${saved.id}`);
  return { errors: [] as string[], saved: true };
}

function Range({ name, label, value, onChange, step = 0.1 }: { name: keyof typeof PARAM_LIMITS; label: string; value: number; onChange: (v: number) => void; step?: number }) {
  const [min, max] = PARAM_LIMITS[name];
  return (
    <div>
      <label className="field-label flex justify-between" htmlFor={name}>
        <span>{label}</span>
        <span className="font-normal text-stone-600">{formatCompact(value)}</span>
      </label>
      <input id={name} name={name} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-brand-700" />
    </div>
  );
}

export default function TemplateEdit({ loaderData, actionData }: Route.ComponentProps) {
  const { template, count, shop, format, samples } = loaderData;
  const [p, setP] = useState<TemplateParams>(template.params);
  const [sampleId, setSampleId] = useState(0);
  const [report, setReport] = useState<FitReport | null>(null);
  const sample = samples.find((s) => s.id === sampleId) ?? samples[0]!;
  const update = (patch: Partial<TemplateParams>) => setP((old) => normalizeParams({ ...old, ...patch }));
  const check = (name: keyof TemplateParams, label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} checked={Boolean(p[name])} onChange={(e) => update({ [name]: e.target.checked })} />
      {label}
    </label>
  );

  return (
    <div className="space-y-5">
      <Link to="/verwaltung/vorlagen" className="text-sm text-stone-600 hover:text-stone-900">
        ‹ Alle Vorlagen
      </Link>
      <h1 className="font-display text-3xl tracking-wide uppercase">{template.id ? template.name : "Neue Vorlage"}</h1>
      {actionData?.saved ? <Notice>Gespeichert.</Notice> : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <Form method="post" className="card space-y-5">
          <div>
            <label className="field-label" htmlFor="name">
              Name
            </label>
            <input id="name" name="name" defaultValue={template.name} required maxLength={60} placeholder="z. B. Weihnachten" className="field-input" />
          </div>
          <div>
            <label className="field-label" htmlFor="variant">
              Grundvariante
            </label>
            <select
              id="variant"
              name="variant"
              value={p.variant}
              onChange={(e) => {
                const v = e.target.value as Variant;
                update({ ...(template.id ? {} : VARIANT_PRESETS[v]), variant: v });
              }}
              className="field-input"
            >
              {Object.entries(VARIANTS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["titleFont", "bodyFont"] as const).map((k) => (
              <div key={k}>
                <label className="field-label" htmlFor={k}>
                  {k === "titleFont" ? "Schrift Titel" : "Schrift Text"}
                </label>
                <select id={k} name={k} value={p[k]} onChange={(e) => update({ [k]: e.target.value })} className="field-input">
                  {Object.entries(FONTS).map(([id, f]) => (
                    <option key={id} value={id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Range name="titleMax" label="Titel: größte Schrift (pt)" value={p.titleMax} onChange={(v) => update({ titleMax: v })} />
            <Range name="titleMin" label="Titel: kleinste Schrift (pt)" value={p.titleMin} onChange={(v) => update({ titleMin: v })} />
            <Range name="bodyMax" label="Text: größte Schrift (pt)" value={p.bodyMax} onChange={(v) => update({ bodyMax: v })} />
            <Range name="bodyMin" label="Text: kleinste Schrift (pt)" value={p.bodyMin} onChange={(v) => update({ bodyMin: v })} />
            <Range name="typeMax" label="Teeart: größte Schrift (pt)" value={p.typeMax} onChange={(v) => update({ typeMax: v })} />
            <Range name="typeMin" label="Teeart: kleinste Schrift (pt)" value={p.typeMin} onChange={(v) => update({ typeMin: v })} />
            <Range name="footerMax" label="Fußzeile: größte Schrift (pt)" value={p.footerMax} onChange={(v) => update({ footerMax: v })} />
            <Range name="footerMin" label="Fußzeile: kleinste Schrift (pt)" value={p.footerMin} onChange={(v) => update({ footerMin: v })} />
            <Range name="artHeight" label="Höhe des Motivs (mm, 0 = aus)" value={p.artHeight} onChange={(v) => update({ artHeight: v })} step={0.5} />
          </div>
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="field-label">Elemente</legend>
            {check("titleUppercase", "Titel in Großbuchstaben")}
            {check("showTeaType", "Teeart anzeigen")}
            {check("showBrew", "Zubereitung anzeigen")}
            {check("showCodes", "Preis, Strich- und QR-Code anzeigen")}
            {check("showFooter", "Fußzeile anzeigen")}
          </fieldset>
          <p className="field-hint">Unter 5,6 pt wird Text auf Bürodruckern schwer lesbar.</p>
          {actionData?.errors?.map((e) => (
            <p key={e} className="field-error">
              {e}
            </p>
          ))}
          <div className="flex flex-wrap gap-3 border-t border-stone-200 pt-4">
            <button className="btn-primary">{template.id ? "Speichern" : "Vorlage anlegen"}</button>
            <button type="button" className="btn-secondary" onClick={() => setP(template.params)}>
              Änderungen verwerfen
            </button>
          </div>
        </Form>
        <div className="space-y-4">
          <div className="card space-y-3">
            <h2 className="font-display text-lg tracking-wide uppercase">Vorschau</h2>
            <select value={sampleId} onChange={(e) => setSampleId(Number(e.target.value))} className="field-input" aria-label="Beispielsorte">
              {samples.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <div className="flex justify-center">
              <FittedPreview widthMm={format.labelWidth} heightMm={format.labelHeight} scale={1.8} fitKey={JSON.stringify(p) + sampleId} onFit={setReport} className="shadow-lg ring-1 ring-stone-200">
                <Label data={sample.content} shop={shop} template={p} size={format} />
              </FittedPreview>
            </div>
            <FitMeter report={report} min={p.bodyMin} max={p.bodyMax} />
          </div>
          {template.id ? (
            <div className="card flex flex-wrap gap-3">
              {!template.isDefault ? (
                <Form method="post">
                  <button className="btn-secondary" name="intent" value="default">
                    Als Standard verwenden
                  </button>
                </Form>
              ) : null}
              {count > 1 ? (
                <Form method="post" onSubmit={(e) => !confirm("Vorlage löschen? Sorten mit dieser Vorlage nutzen danach die Standardvorlage.") && e.preventDefault()}>
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
