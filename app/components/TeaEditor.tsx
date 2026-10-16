import { useMemo, useState, type ReactNode } from "react";
import { Form, useNavigation } from "react-router";
import { LABELS_PER_SHEET, layoutPages, SHEET } from "~/label/geometry";
import { Label, SheetPage, type LabelData, type ShopInfo } from "~/label/Label";
import { colorForTeaType, isHexColor, TEA_TYPES } from "~/label/tea-types";
import { FittedPreview } from "./FittedPreview";

export type TeaFormValues = LabelData;
export type TeaFormErrors = Partial<Record<keyof TeaFormValues, string>>;

const LIMITS = { name: 60, teaType: 40, description: 600, ingredients: 400 } as const;
const SWATCHES = Array.from(new Set(TEA_TYPES.map((t) => t.color)));

export interface PrintLayout {
  count: number;
  start: number;
}

export function TeaEditor({
  initial,
  errors,
  shop,
  isNew,
  printLayout,
  renderAside,
  formActions,
}: {
  initial: TeaFormValues;
  errors?: TeaFormErrors;
  shop: ShopInfo;
  isNew: boolean;
  printLayout?: PrintLayout;
  /** Bereich unter der Vorschau, z. B. das Druckfeld */
  renderAside?: (state: { dirty: boolean }) => ReactNode;
  /** zusätzliche Schaltflächen neben „Speichern“ */
  formActions?: ReactNode;
}) {
  const navigation = useNavigation();
  const saving = navigation.state === "submitting" && navigation.formData?.get("intent") === "save";
  const [values, setValues] = useState<TeaFormValues>(initial);
  const [colorTouched, setColorTouched] = useState(!isNew && colorForTeaType(initial.teaType) !== initial.color);
  const [overflow, setOverflow] = useState(0);
  const [view, setView] = useState<"label" | "sheet">("label");

  const dirty = (Object.keys(initial) as (keyof TeaFormValues)[]).some((k) => initial[k].trim() !== values[k].trim());

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

  const previewData: LabelData = { ...values, color: isHexColor(values.color) ? values.color : "#777777" };
  const fitKey = JSON.stringify(previewData) + view + (printLayout ? `${printLayout.count}/${printLayout.start}` : "");
  const firstSheet = useMemo(
    () => layoutPages(printLayout?.count ?? LABELS_PER_SHEET, printLayout?.start ?? 1)[0]!,
    [printLayout?.count, printLayout?.start],
  );

  const counter = (key: keyof typeof LIMITS) => (
    <span className={values[key].length > LIMITS[key] ? "text-red-700" : ""}>
      {values[key].length}/{LIMITS[key]}
    </span>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
      <Form method="post" className="card space-y-5" id="tea-form">
        <input type="hidden" name="intent" value="save" />
        <div>
          <label className="field-label" htmlFor="name">
            Name des Tees
          </label>
          <input id="name" name="name" value={values.name} onChange={set("name")} required maxLength={LIMITS.name} className="field-input" autoFocus={isNew} />
          {errors?.name ? <p className="field-error">{errors.name}</p> : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="teaType">
              Teeart
            </label>
            <input id="teaType" name="teaType" list="tea-types" value={values.teaType} onChange={set("teaType")} maxLength={LIMITS.teaType} className="field-input" placeholder="z. B. Grüner Tee" />
            <datalist id="tea-types">
              {TEA_TYPES.map((t) => (
                <option key={t.name} value={t.name} />
              ))}
            </datalist>
            {errors?.teaType ? <p className="field-error">{errors.teaType}</p> : <p className="field-hint">Bekannte Teearten setzen automatisch eine passende Farbe.</p>}
          </div>
          <div>
            <span className="field-label">Farbe der Tasse</span>
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
                <input type="color" value={isHexColor(values.color) ? values.color : "#777777"} onChange={(e) => pickColor(e.target.value)} className="size-7 cursor-pointer rounded border border-stone-300 bg-white p-0.5" />
                eigene
              </label>
            </div>
            {errors?.color ? <p className="field-error">{errors.color}</p> : null}
          </div>
        </div>

        <div>
          <label className="field-label flex justify-between" htmlFor="description">
            <span>Beschreibung</span>
            <span className="text-xs font-normal text-stone-500">{counter("description")}</span>
          </label>
          <textarea id="description" name="description" rows={6} value={values.description} onChange={set("description")} className="field-input" />
          {errors?.description ? <p className="field-error">{errors.description}</p> : null}
        </div>

        <div>
          <label className="field-label flex justify-between" htmlFor="ingredients">
            <span>Zutaten</span>
            <span className="text-xs font-normal text-stone-500">{counter("ingredients")}</span>
          </label>
          <textarea id="ingredients" name="ingredients" rows={3} value={values.ingredients} onChange={set("ingredients")} className="field-input" placeholder="z. B. Grüner Tee (China)" />
          {errors?.ingredients ? <p className="field-error">{errors.ingredients}</p> : <p className="field-hint">Erscheint auf dem Etikett nach „Zutaten:“.</p>}
        </div>

        {overflow > 0 ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Der Text passt selbst in kleinster Schrift nicht vollständig aufs Etikett (rot markiert). Bitte kürzen.
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

      <div className="space-y-4">
        <div className="card">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg tracking-wide uppercase">Vorschau</h2>
            <div className="flex rounded-lg border border-stone-300 p-0.5 text-sm">
              {(["label", "sheet"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setView(v)} className={`rounded-md px-3 py-1 ${view === v ? "bg-stone-800 text-white" : "text-stone-700"}`}>
                  {v === "label" ? "Etikett" : "Bogen"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-center overflow-x-auto">
            {view === "label" ? (
              <FittedPreview widthMm={45.5} heightMm={95.3} scale={1.8} fitKey={fitKey} onOverflow={setOverflow} className="shadow-lg ring-1 ring-stone-200">
                <Label data={previewData} shop={shop} />
              </FittedPreview>
            ) : (
              <FittedPreview widthMm={SHEET.pageWidth} heightMm={SHEET.pageHeight} scale={0.42} fitKey={fitKey} onOverflow={(n) => setOverflow(n > 0 ? 1 : 0)} className="shadow-lg ring-1 ring-stone-200">
                <SheetPage slots={firstSheet.map((filled) => (filled ? <Label data={previewData} shop={shop} /> : null))} />
              </FittedPreview>
            )}
          </div>
          <p className="mt-3 text-center text-xs text-stone-500">
            {view === "label" ? "Darstellung entspricht dem Druck." : "Erster Bogen ohne Druckerkorrektur, freie Felder bleiben leer."}
          </p>
        </div>
        {renderAside?.({ dirty })}
      </div>
    </div>
  );
}
