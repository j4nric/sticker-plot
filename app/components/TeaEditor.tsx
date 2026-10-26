import { useMemo, useRef, useState, type ReactNode } from "react";
import { Form, useNavigation } from "react-router";
import { validColor } from "~/label/color";
import type { PrintLayout, SheetGeometry } from "~/label/geometry";
import type { LabelContent, ShopInfo } from "~/label/Label";
import { MOTIFS } from "~/label/motifs";
import { isTeaKind, TEA_KIND_KEYS, TEA_KINDS, teaTypeLabel } from "~/label/tea-types";
import type { TemplateParams } from "~/label/template";
import { unsupportedChars } from "~/label/text";
import { FormatToolbar } from "./FormatToolbar";
import { LabelPreviewPanel } from "./LabelPreviewPanel";
import { Notice } from "./Notice";

export interface TeaFormValues {
  name: string;
  /** Titel auf dem Etikett; leer = Name */
  title: string;
  kind: string;
  flavored: boolean;
  description: string;
  ingredients: string;
  motif: string;
  templateId: string;
  brewAmount: string;
  brewTemp: string;
  brewTime: string;
  organic: boolean;
  ean: string;
  productUrl: string;
  price: string;
  shelfLifeMonths: string;
}
export type TeaFormErrors = Partial<Record<keyof TeaFormValues, string>>;

export const EMPTY_TEA: TeaFormValues = {
  name: "",
  title: "",
  kind: "",
  flavored: false,
  description: "",
  ingredients: "",
  motif: "auto",
  templateId: "",
  brewAmount: "",
  brewTemp: "",
  brewTime: "",
  organic: false,
  ean: "",
  productUrl: "",
  price: "",
  shelfLifeMonths: "",
};

/** Farbe und Motiv-URL je Teeart aus den Einstellungen */
export type KindLook = Record<string, { color: string; imageSrc: string | null }>;

export interface TemplateOption {
  id: number;
  name: string;
  isDefault: boolean;
  params: TemplateParams;
}

export function TeaEditor({
  initial,
  errors,
  shop,
  kinds,
  legacyTeaType,
  legacyColor,
  isNew,
  templates,
  format,
  imageSrc,
  printLayout,
  renderAside,
  formActions,
  imageSlot,
}: {
  initial: TeaFormValues;
  errors?: TeaFormErrors;
  shop: ShopInfo;
  kinds: KindLook;
  /** Teeart-Text und Farbe alter Sorten, solange keine der fünf Arten gewählt ist */
  legacyTeaType?: string;
  legacyColor?: string;
  isNew: boolean;
  templates: TemplateOption[];
  format: SheetGeometry;
  imageSrc?: string | null;
  printLayout?: PrintLayout;
  /** Bereich unter der Vorschau, z. B. das Druckfeld */
  renderAside?: (state: { dirty: boolean }) => ReactNode;
  /** zusätzliche Schaltflächen neben „Speichern“ */
  formActions?: ReactNode;
  /** Bild-Upload (eigenes Formular, daher außerhalb des Hauptformulars) */
  imageSlot?: ReactNode;
}) {
  const navigation = useNavigation();
  const saving = navigation.state === "submitting" && navigation.formData?.get("intent") === "save";
  const [values, setValues] = useState<TeaFormValues>(initial);
  const [overflowing, setOverflowing] = useState(false);
  const ingredientsRef = useRef<HTMLTextAreaElement>(null);

  const dirty = JSON.stringify(initial) !== JSON.stringify(values);
  const defaultTemplate = templates.find((t) => t.isDefault) ?? templates[0]!;
  const template = templates.find((t) => String(t.id) === values.templateId) ?? defaultTemplate;

  const set = (key: keyof TeaFormValues) => (e: { target: { value: string } }) => {
    const value = e.target.value;
    setValues((v) => ({ ...v, [key]: value }));
  };

  const kind = isTeaKind(values.kind) ? values.kind : null;
  const content: LabelContent = useMemo(
    () => ({
      ...values,
      name: values.title.trim() || values.name,
      teaType: kind ? teaTypeLabel(kind, values.flavored) : (legacyTeaType ?? ""),
      color: validColor(kind ? (kinds[kind]?.color ?? TEA_KINDS[kind].color) : (legacyColor ?? TEA_KINDS.gruen.color)),
      brewTemp: values.brewTemp ? Number(values.brewTemp) || null : null,
      imageSrc: imageSrc ?? null,
      kindImageSrc: kind ? (kinds[kind]?.imageSrc ?? null) : null,
    }),
    [values, kind, kinds, imageSrc, legacyTeaType, legacyColor],
  );

  const badChars = unsupportedChars([values.name, values.title, values.description, values.ingredients, values.brewAmount, values.brewTime, values.price].join(""));

  const field = (key: keyof TeaFormValues, label: string, props: Record<string, unknown> = {}, hint?: string) => (
    <div>
      <label className="field-label" htmlFor={key}>
        {label}
      </label>
      <input id={key} name={key} value={values[key] as string} onChange={set(key)} className="field-input" autoComplete="off" {...props} />
      {errors?.[key] ? <p className="field-error">{errors[key]}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)]">
      <div className="space-y-4">
        <Form method="post" className="card space-y-5" id="tea-form">
          <input type="hidden" name="intent" value="save" />
          <div className="grid gap-5 lg:grid-cols-2">
            {field("name", "Name in der App", { required: true, maxLength: 80, autoFocus: isNew }, "Für Liste und Suche, z. B. „Wilde Kirsche (Rooibos)“.")}
            <div>
              <label className="field-label" htmlFor="title">
                Titel auf dem Etikett
              </label>
              <textarea
                id="title"
                name="title"
                rows={2}
                value={values.title}
                onChange={set("title")}
                maxLength={80}
                placeholder={values.name || "wie der Name"}
                className="field-input"
              />
              {errors?.title ? <p className="field-error">{errors.title}</p> : <p className="field-hint">Leer = wie der Name. Mit Zeilenumbruch selbst trennen.</p>}
            </div>
          </div>

          <fieldset>
            <legend className="field-label">Teeart</legend>
            <input type="hidden" name="kind" value={values.kind} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" role="radiogroup" aria-label="Teeart">
              {TEA_KIND_KEYS.map((k) => {
                const active = values.kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setValues((v) => ({ ...v, kind: k }))}
                    className={`flex min-h-14 items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-lg font-semibold transition ${active ? "border-stone-900 bg-white shadow-md" : "border-stone-200 bg-stone-50 text-stone-700"}`}
                  >
                    <span className="size-6 flex-none rounded-full ring-2 ring-white" style={{ background: kinds[k]?.color ?? TEA_KINDS[k].color }} aria-hidden="true" />
                    {TEA_KINDS[k].name}
                  </button>
                );
              })}
            </div>
            <label className="mt-4 inline-flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 border-stone-200 px-4 py-2 text-lg font-semibold text-stone-800">
              <input type="checkbox" name="flavored" checked={values.flavored} onChange={(e) => setValues((v) => ({ ...v, flavored: e.target.checked }))} className="size-6 accent-brand-700" />
              aromatisiert
            </label>
            {errors?.kind ? (
              <p className="field-error">{errors.kind}</p>
            ) : (
              <p className="field-hint">
                Auf dem Etikett: <b>{kind ? teaTypeLabel(kind, values.flavored) : legacyTeaType ? `„${legacyTeaType}“ (bitte eine Art wählen)` : "bitte eine Art wählen"}</b>. Farbe und
                Motiv kommen aus den Einstellungen.
              </p>
            )}
          </fieldset>

          <div>
            <label className="field-label" htmlFor="description">
              Beschreibung
            </label>
            <textarea id="description" name="description" rows={6} value={values.description} onChange={set("description")} className="field-input" />
            {errors?.description ? <p className="field-error">{errors.description}</p> : <p className="field-hint">Zeilenumbrüche und Leerzeilen werden übernommen.</p>}
          </div>

          <div>
            <div className="flex items-end justify-between gap-2">
              <label className="field-label" htmlFor="ingredients">
                Zutaten
              </label>
              <FormatToolbar fieldRef={ingredientsRef} value={values.ingredients} onChange={(ingredients) => setValues((v) => ({ ...v, ingredients }))} />
            </div>
            <textarea
              ref={ingredientsRef}
              id="ingredients"
              name="ingredients"
              rows={3}
              value={values.ingredients}
              onChange={set("ingredients")}
              className="field-input"
              placeholder="z. B. Grüner Tee, *Mandel*stücke, Aroma"
            />
            {errors?.ingredients ? (
              <p className="field-error">{errors.ingredients}</p>
            ) : (
              <p className="field-hint">
                Allergene hervorheben: Wort markieren und <b>F</b> (fett), <u>U</u> (unterstrichen) oder <i>K</i> (kursiv) drücken. Im Text steht dann *fett*,
                ++unterstrichen++ oder _kursiv_, auch kombiniert.
              </p>
            )}
          </div>

          <fieldset className="rounded-lg border border-stone-200 p-4">
            <legend className="px-1 text-sm font-semibold text-stone-700">Zubereitung (optional)</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              {field("brewAmount", "Menge", { placeholder: "z. B. 1 TL / 250 ml", maxLength: 30 })}
              {field("brewTemp", "Temperatur (°C)", { inputMode: "numeric", placeholder: "z. B. 80", maxLength: 3 })}
              {field("brewTime", "Ziehzeit", { placeholder: "z. B. 2-3", maxLength: 30 }, "Zahlen werden zu „Min.“")}
            </div>
          </fieldset>

          <details className="rounded-lg border border-stone-200 p-4" open={Boolean(values.ean || values.productUrl || values.price || values.organic || values.shelfLifeMonths) || undefined}>
            <summary className="cursor-pointer text-sm font-semibold text-stone-700">Weitere Angaben: Bio, Preis, Barcode, Haltbarkeit</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-stone-700 sm:col-span-2">
                <input type="checkbox" name="organic" checked={values.organic} onChange={(e) => setValues((v) => ({ ...v, organic: e.target.checked }))} />
                Bio-Ware (druckt „BIO“ und die Öko-Kontrollstelle aus den Einstellungen)
              </label>
              {field("price", "Preis", { placeholder: "z. B. 8,90 € / 100 g", maxLength: 30 })}
              {field("shelfLifeMonths", "Haltbarkeit in Monaten", { inputMode: "numeric", placeholder: "z. B. 24", maxLength: 3 }, "Schlägt beim Drucken das MHD vor.")}
              {field("ean", "EAN (Strichcode)", { inputMode: "numeric", placeholder: "13 Ziffern", maxLength: 16 }, "Bei 12 Ziffern wird die Prüfziffer ergänzt.")}
              {field("productUrl", "Link für QR-Code", { type: "url", placeholder: "https://…", maxLength: 300 })}
            </div>
          </details>

          <fieldset className="rounded-lg border border-stone-200 p-4">
            <legend className="px-1 text-sm font-semibold text-stone-700">Gestaltung</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="templateId">
                  Vorlage
                </label>
                <select id="templateId" name="templateId" value={values.templateId} onChange={set("templateId")} className="field-input">
                  <option value="">Standard ({defaultTemplate.name})</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="motif">
                  Motiv
                </label>
                <select id="motif" name="motif" value={values.motif} onChange={set("motif")} className="field-input">
                  {Object.entries(MOTIFS).map(([id, label]) => (
                    <option key={id} value={id} disabled={id === "bild" && !imageSrc}>
                      {label}
                      {id === "auto" && kind ? ` (${kinds[kind]?.imageSrc ? "zentrales Bild" : "Zeichnung"} ${TEA_KINDS[kind].name})` : ""}
                      {id === "bild" && !imageSrc ? " (zuerst Bild hochladen)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          {badChars.length ? (
            <Notice tone="warning">
              Diese Zeichen können nicht gedruckt werden und müssen entfernt werden: <b>{badChars.join(" ")}</b>
            </Notice>
          ) : null}
          {overflowing ? (
            <Notice tone="warning">
              Der Text passt selbst in kleinster Schrift nicht vollständig aufs Etikett (rot markiert). Bitte kürzen, sonst wird kein PDF erstellt.
            </Notice>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 border-t border-stone-200 pt-4">
            <button className="btn-primary" disabled={saving || (!dirty && !isNew)}>
              {saving ? "Speichert …" : isNew ? "Tee anlegen" : "Änderungen speichern"}
            </button>
            {!isNew && dirty ? <span className="text-sm text-amber-700">Ungespeicherte Änderungen</span> : null}
            {formActions}
          </div>
        </Form>
        {imageSlot}
      </div>

      <div className="space-y-4">
        <LabelPreviewPanel content={content} shop={shop} template={template.params} format={format} printLayout={printLayout} onOverflowChange={setOverflowing} />
        {renderAside?.({ dirty })}
      </div>
    </div>
  );
}
