import { useMemo, useRef, useState, type ReactNode } from "react";
import { Form, useNavigation } from "react-router";
import { validColor } from "~/label/color";
import type { PrintLayout, SheetGeometry } from "~/label/geometry";
import type { LabelContent, ShopInfo } from "~/label/Label";
import { MOTIFS } from "~/label/motifs";
import { colorForTeaType, DEFAULT_TEA_COLOR, TEA_TYPES } from "~/label/tea-types";
import type { TemplateParams } from "~/label/template";
import { unsupportedChars } from "~/label/text";
import { FormatToolbar } from "./FormatToolbar";
import { LabelPreviewPanel } from "./LabelPreviewPanel";

export interface TeaFormValues {
  name: string;
  teaType: string;
  description: string;
  ingredients: string;
  color: string;
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
  teaType: "",
  description: "",
  ingredients: "",
  color: DEFAULT_TEA_COLOR,
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

const SWATCHES = Array.from(new Set(TEA_TYPES.map((t) => t.color)));

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
  const [colorTouched, setColorTouched] = useState(!isNew && colorForTeaType(initial.teaType) !== initial.color);
  const [overflowing, setOverflowing] = useState(false);
  const ingredientsRef = useRef<HTMLTextAreaElement>(null);

  const dirty = JSON.stringify(initial) !== JSON.stringify(values);
  const defaultTemplate = templates.find((t) => t.isDefault) ?? templates[0]!;
  const template = templates.find((t) => String(t.id) === values.templateId) ?? defaultTemplate;

  const set = (key: keyof TeaFormValues) => (e: { target: { value: string } }) => {
    const value = e.target.value;
    setValues((v) => {
      const next = { ...v, [key]: value };
      if (key === "teaType" && !colorTouched) {
        const preset = colorForTeaType(value);
        if (preset) next.color = preset;
      }
      return next;
    });
  };
  const pickColor = (color: string) => {
    setColorTouched(true);
    setValues((v) => ({ ...v, color }));
  };

  const content: LabelContent = useMemo(
    () => ({ ...values, color: validColor(values.color), brewTemp: values.brewTemp ? Number(values.brewTemp) || null : null, imageSrc: imageSrc ?? null }),
    [values, imageSrc],
  );

  const badChars = unsupportedChars([values.name, values.teaType, values.description, values.ingredients, values.brewAmount, values.brewTime, values.price].join(""));

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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="space-y-4">
        <Form method="post" className="card space-y-5" id="tea-form">
          <input type="hidden" name="intent" value="save" />
          {field("name", "Name des Tees", { required: true, maxLength: 80, autoFocus: isNew })}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="teaType">
                Teeart
              </label>
              <input id="teaType" name="teaType" list="tea-types" value={values.teaType} onChange={set("teaType")} maxLength={40} className="field-input" placeholder="z. B. Grüner Tee" autoComplete="off" />
              <datalist id="tea-types">
                {TEA_TYPES.map((t) => (
                  <option key={t.name} value={t.name} />
                ))}
              </datalist>
              {errors?.teaType ? <p className="field-error">{errors.teaType}</p> : <p className="field-hint">Bekannte Teearten setzen Farbe und Motiv automatisch.</p>}
            </div>
            <div>
              <span className="field-label">Farbe</span>
              <input type="hidden" name="color" value={values.color} />
              <div className="flex flex-wrap items-center gap-1.5">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => pickColor(c)}
                    className={`size-7 rounded-full border-2 ${values.color.toLowerCase() === c ? "border-stone-900 ring-2 ring-stone-300" : "border-white shadow"}`}
                    style={{ background: c }}
                    title={TEA_TYPES.filter((t) => t.color === c).map((t) => t.name).join(", ")}
                    aria-label={`Farbe ${c}`}
                  />
                ))}
                <label className="relative ml-1 inline-flex cursor-pointer items-center gap-1 text-xs text-stone-600" title="Eigene Farbe">
                  <input type="color" value={validColor(values.color)} onChange={(e) => pickColor(e.target.value)} className="size-7 cursor-pointer rounded border border-stone-300 bg-white p-0.5" />
                  eigene
                </label>
              </div>
              {errors?.color ? <p className="field-error">{errors.color}</p> : <p className="field-hint">Sehr helle Farben werden für Schrift automatisch abgedunkelt.</p>}
            </div>
          </div>

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
                <input type="checkbox" name="organic" checked={values.organic} onChange={(e) => setValues((v) => ({ ...v, organic: e.target.checked }))} className="size-4" />
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
                      {id === "bild" && !imageSrc ? " (zuerst Bild hochladen)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          {badChars.length ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Diese Zeichen können nicht gedruckt werden und müssen entfernt werden: <b>{badChars.join(" ")}</b>
            </p>
          ) : null}
          {overflowing ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Der Text passt selbst in kleinster Schrift nicht vollständig aufs Etikett (rot markiert). Bitte kürzen, sonst wird kein PDF erstellt.
            </p>
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
