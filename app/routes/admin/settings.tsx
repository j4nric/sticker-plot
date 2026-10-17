import { useRef, useState } from "react";
import { data, Form } from "react-router";
import { FittedPreview } from "~/components/FittedPreview";
import { FormatToolbar } from "~/components/FormatToolbar";
import { FOOTER_SEPARATORS, Label, type FooterSeparator, type LabelContent } from "~/label/Label";
import { unsupportedChars } from "~/label/text";
import { currentUser } from "~/lib/session.server";
import { audit } from "~/models/audit.server";
import { listFormats } from "~/models/format.server";
import { getSettings, saveSettings } from "~/models/settings.server";
import { listTemplates } from "~/models/template.server";
import { Notice } from "~/components/Notice";
import type { Route } from "./+types/settings";

export function meta() {
  return [{ title: "Einstellungen · Tee-Etiketten" }];
}

const SAMPLE: LabelContent = {
  name: "China Sencha",
  teaType: "Grüner Tee",
  description: "Ein Grüntee mit mittelgrünem, flachgepresstem Blatt und einer feinherben, leicht heuigen Note.",
  ingredients: "Grüner Tee (China), *Mandel*stücke",
  color: "#4f9a3f",
};

export function loader() {
  return { settings: getSettings(), template: listTemplates()[0]!.params, format: listFormats()[0]! };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = currentUser(context);
  const form = await request.formData();
  const str = (k: string, max: number) => String(form.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const separator = String(form.get("separator") ?? "blatt");
  const shop = {
    name: str("name", 80),
    url: str("url", 80),
    address: str("address", 120),
    organicCode: str("organicCode", 30),
    separator: (separator in FOOTER_SEPARATORS ? separator : "blatt") as FooterSeparator,
    footerItalic: form.get("footerItalic") === "on",
  };
  const bad = unsupportedChars([shop.name, shop.url, shop.address, shop.organicCode].join(""));
  if (bad.length) return data({ error: `Diese Zeichen können nicht gedruckt werden: ${bad.join(" ")}`, saved: false }, { status: 400 });
  if (shop.organicCode && !/^[A-Z]{2}-[A-ZÖÄÜ]{2,4}-\d{2,3}$/i.test(shop.organicCode)) {
    return data({ error: "Öko-Kontrollstelle im Format DE-ÖKO-006 angeben.", saved: false }, { status: 400 });
  }
  saveSettings({ shop, overflowPolicy: form.get("overflowPolicy") === "warn" ? "warn" : "block" });
  audit(user.username, "ändern", "einstellungen", null, `Fußzeile: ${shop.name} | ${shop.url} | ${shop.address}`);
  return { error: undefined, saved: true };
}

function FooterField({
  id,
  label,
  value,
  onChange,
  maxLength,
  placeholder,
}: {
  id: "name" | "url" | "address";
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        <FormatToolbar fieldRef={ref} value={value} onChange={onChange} />
      </div>
      <input ref={ref} id={id} name={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={maxLength} placeholder={placeholder} className="field-input" />
    </div>
  );
}

export default function Settings({ loaderData, actionData }: Route.ComponentProps) {
  const { settings: s, template, format } = loaderData;
  const [shop, setShop] = useState(s.shop);
  const update = (patch: Partial<typeof shop>) => setShop((old) => ({ ...old, ...patch }));
  const bad = unsupportedChars([shop.name, shop.url, shop.address].join(""));

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl tracking-wide uppercase">Einstellungen</h1>
      {actionData?.saved ? <Notice>Gespeichert.</Notice> : null}
      <Form method="post" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-5">
          <section className="card space-y-4">
            <h2 className="font-display text-lg tracking-wide uppercase">Fußzeile auf jedem Etikett</h2>
            <p className="text-sm text-stone-600">
              Zwei Texte nebeneinander mit Trenner und eine optionale zweite Zeile. Leere Felder werden weggelassen. Formatierung wie bei den Zutaten: *fett*,
              ++unterstrichen++, _kursiv_.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FooterField id="name" label="Text links" value={shop.name} onChange={(name) => update({ name })} maxLength={80} placeholder="z. B. Tee-Treff-Punkt" />
              <FooterField id="url" label="Text rechts" value={shop.url} onChange={(url) => update({ url })} maxLength={80} placeholder="z. B. www.teetreffpunkt.de" />
              <div className="sm:col-span-2">
                <FooterField
                  id="address"
                  label="Zweite Zeile (optional)"
                  value={shop.address}
                  onChange={(address) => update({ address })}
                  maxLength={120}
                  placeholder="z. B. Musterstraße 1, 12345 Musterstadt"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="separator">
                  Trenner zwischen links und rechts
                </label>
                <select id="separator" name="separator" value={shop.separator} onChange={(e) => update({ separator: e.target.value as FooterSeparator })} className="field-input">
                  {Object.entries(FOOTER_SEPARATORS).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-stone-700">
                <input type="checkbox" name="footerItalic" checked={shop.footerItalic} onChange={(e) => update({ footerItalic: e.target.checked })} className="size-4" />
                Fußzeile kursiv
              </label>
            </div>
            {bad.length ? <p className="field-error">Diese Zeichen können nicht gedruckt werden: {bad.join(" ")}</p> : null}
            <p className="field-hint">Ob die Fußzeile überhaupt erscheint, lässt sich je Vorlage unter Verwaltung → Vorlagen einstellen.</p>
          </section>

          <section className="card space-y-4">
            <h2 className="font-display text-lg tracking-wide uppercase">Weitere Angaben</h2>
            <div className="max-w-xs">
              <label className="field-label" htmlFor="organicCode">
                Öko-Kontrollstelle (für Bio-Tees)
              </label>
              <input
                id="organicCode"
                name="organicCode"
                value={shop.organicCode}
                onChange={(e) => update({ organicCode: e.target.value })}
                maxLength={30}
                placeholder="DE-ÖKO-006"
                className="field-input"
              />
            </div>
            <fieldset>
              <legend className="field-label">Wenn Text nicht aufs Etikett passt</legend>
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" name="overflowPolicy" value="block" defaultChecked={s.overflowPolicy === "block"} className="mt-1" />
                <span>
                  <b>PDF verweigern</b> mit der Möglichkeit, es trotzdem zu erstellen (empfohlen)
                </span>
              </label>
              <label className="mt-1 flex items-start gap-2 text-sm">
                <input type="radio" name="overflowPolicy" value="warn" defaultChecked={s.overflowPolicy === "warn"} className="mt-1" />
                <span>
                  <b>Nur warnen</b>, PDF wird mit abgeschnittenem Text erstellt
                </span>
              </label>
            </fieldset>
          </section>

          {actionData?.error ? <p className="field-error">{actionData.error}</p> : null}
          <button className="btn-primary">Speichern</button>
        </div>

        <aside className="card space-y-3 self-start">
          <h2 className="font-display text-lg tracking-wide uppercase">Vorschau</h2>
          <div className="flex justify-center">
            <FittedPreview widthMm={format.labelWidth} heightMm={format.labelHeight} scale={1.6} fitKey={JSON.stringify(shop)} className="shadow-lg ring-1 ring-stone-200">
              <Label data={SAMPLE} shop={shop} template={template} size={format} />
            </FittedPreview>
          </div>
          <p className="text-center text-xs text-stone-500">Beispielsorte mit der Standardvorlage</p>
        </aside>
      </Form>
    </div>
  );
}
