import { useRef, useState } from "react";
import { data, Form, useFetcher } from "react-router";
import { FittedPreview } from "~/components/FittedPreview";
import { FormatToolbar } from "~/components/FormatToolbar";
import { FOOTER_SEPARATORS, Label, type FooterSeparator, type LabelContent } from "~/label/Label";
import { unsupportedChars } from "~/label/text";
import { currentUser } from "~/lib/session.server";
import { audit } from "~/models/audit.server";
import { listFormats } from "~/models/format.server";
import { getKindSettings, getSettings, saveKindSettings, saveSettings } from "~/models/settings.server";
import { deleteUnusedImages, MAX_IMAGE_BYTES, sanitizeSvg, saveImage, sniffImageType } from "~/models/image.server";
import { isHexColor } from "~/label/color";
import { isTeaKind, TEA_KIND_KEYS, TEA_KINDS, type TeaKind } from "~/label/tea-types";
import { listTemplates } from "~/models/template.server";
import { Notice } from "~/components/Notice";
import type { Route } from "./+types/settings";

export function meta() {
  return [{ title: "Einstellungen · Tee-Etiketten" }];
}

const SAMPLE: LabelContent = {
  name: "China Sencha",
  teaType: "Aromatisierter Grüntee",
  kind: "gruen",
  description: "Ein Grüntee mit mittelgrünem, flachgepresstem Blatt und einer feinherben, leicht heuigen Note.",
  ingredients: "Grüner Tee (China), *Mandel*stücke",
  color: "#4f9a3f",
};

export function loader() {
  const settings = getSettings();
  return {
    settings,
    kinds: TEA_KIND_KEYS.map((k) => ({ key: k, name: TEA_KINDS[k].name, color: settings.kinds[k].color, imageSrc: settings.kinds[k].imageId ? `/bilder/${settings.kinds[k].imageId}` : null })),
    template: listTemplates()[0]!.params,
    format: listFormats()[0]!,
  };
}

/** Farbe und Motiv einer Teeart; Farbe wird beim Loslassen des Farbwählers gespeichert. */
function KindRow({ kind }: { kind: { key: TeaKind; name: string; color: string; imageSrc: string | null } }) {
  const fetcher = useFetcher<{ kindError?: string }>();
  const busy = fetcher.state !== "idle";
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <li className="flex flex-wrap items-center gap-4 py-4">
      <div className="flex size-20 flex-none items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
        {kind.imageSrc ? <img src={kind.imageSrc} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-stone-400">Zeichnung</span>}
      </div>
      <div className="min-w-40 flex-1">
        <p className="text-lg font-semibold">{kind.name}</p>
        {fetcher.data?.kindError ? <p className="field-error">{fetcher.data.kindError}</p> : null}
      </div>
      <fetcher.Form method="post" className="flex items-center gap-2">
        <input type="hidden" name="intent" value="kind-color" />
        <input type="hidden" name="kind" value={kind.key} />
        <label className="flex items-center gap-2 text-base font-semibold text-stone-700">
          Farbe
          <input
            type="color"
            name="color"
            defaultValue={kind.color}
            key={kind.color}
            onChange={(e) => fetcher.submit(e.currentTarget.form)}
            className="h-12 w-16 cursor-pointer rounded-lg border border-stone-300 bg-white p-1"
          />
        </label>
      </fetcher.Form>
      <fetcher.Form method="post" encType="multipart/form-data" className="flex items-center gap-2">
        <input type="hidden" name="intent" value="kind-image" />
        <input type="hidden" name="kind" value={kind.key} />
        <input
          ref={fileRef}
          type="file"
          name="bild"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => e.currentTarget.files?.length && fetcher.submit(e.currentTarget.form)}
        />
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
          {kind.imageSrc ? "Motiv ersetzen" : "Motiv hochladen"}
        </button>
      </fetcher.Form>
      {kind.imageSrc ? (
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="kind-image-remove" />
          <input type="hidden" name="kind" value={kind.key} />
          <button className="btn-secondary" disabled={busy}>
            Motiv entfernen
          </button>
        </fetcher.Form>
      ) : null}
    </li>
  );
}

/** Farbe oder Motiv einer Teeart speichern (eigene Formulare je Art). */
async function kindAction(form: FormData, user: string) {
  const kind = String(form.get("kind"));
  if (!isTeaKind(kind)) return data({ kindError: "Unbekannte Teeart", kind: null }, { status: 400 });
  const kinds = getKindSettings();
  const intent = form.get("intent");
  if (intent === "kind-color") {
    const color = String(form.get("color") ?? "").toLowerCase();
    if (!isHexColor(color)) return data({ kindError: "Ungültige Farbe", kind }, { status: 400 });
    kinds[kind] = { ...kinds[kind], color };
  } else if (intent === "kind-image") {
    const file = form.get("bild");
    if (!(file instanceof File) || file.size === 0) return data({ kindError: "Bitte eine Bilddatei auswählen.", kind }, { status: 400 });
    if (file.size > MAX_IMAGE_BYTES) return data({ kindError: "Das Bild ist größer als 3 MB.", kind }, { status: 400 });
    let buf: Buffer = Buffer.from(await file.arrayBuffer());
    const mime = sniffImageType(buf);
    if (!mime) return data({ kindError: "Unbekanntes Bildformat. Erlaubt sind PNG, JPG, WebP und SVG.", kind }, { status: 400 });
    if (mime === "image/svg+xml") buf = Buffer.from(sanitizeSvg(buf.toString("utf8")), "utf8");
    kinds[kind] = { ...kinds[kind], imageId: saveImage(mime, buf) };
  } else if (intent === "kind-image-remove") {
    kinds[kind] = { ...kinds[kind], imageId: null };
  } else {
    return data({ kindError: "Unbekannte Aktion", kind }, { status: 400 });
  }
  saveKindSettings(kinds);
  deleteUnusedImages();
  audit(user, "ändern", "einstellungen", null, `Teeart ${TEA_KINDS[kind].name}: ${intent === "kind-color" ? kinds[kind].color : intent === "kind-image" ? "Motiv hochgeladen" : "Motiv entfernt"}`);
  return { kindError: undefined, kind };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = currentUser(context);
  const form = await request.formData();
  if (String(form.get("intent") ?? "").startsWith("kind-")) return kindAction(form, user.username);
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
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        <FormatToolbar fieldRef={ref} value={value} onChange={onChange} />
      </div>
      {/* mehrzeiliges Feld, damit langer Text sichtbar bleibt; Zeilenumbrüche werden beim Speichern zu Leerzeichen */}
      <textarea
        ref={ref}
        id={id}
        name={id}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\s*\n\s*/g, " "))}
        maxLength={maxLength}
        placeholder={placeholder}
        className="field-input resize-none"
      />
    </div>
  );
}

export default function Settings({ loaderData, actionData: rawActionData }: Route.ComponentProps) {
  // Teeart-Formulare laufen über eigene Fetcher; hier nur das Ergebnis des Hauptformulars
  const actionData = rawActionData as { saved?: boolean; error?: string } | undefined;
  const { settings: s, kinds, template, format } = loaderData;
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
                <input type="checkbox" name="footerItalic" checked={shop.footerItalic} onChange={(e) => update({ footerItalic: e.target.checked })} />
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

      <section className="card space-y-2">
        <h2 className="font-display text-lg tracking-wide uppercase">Teearten: Farbe und Motiv</h2>
        <p className="text-stone-700">
          Jede Sorte bekommt Farbe und Motiv ihrer Teeart. Ohne eigenes Motiv wird die passende Zeichnung verwendet. Motive am besten als PNG
          mit transparentem Hintergrund, etwa quadratisch. Änderungen gelten sofort für alle Sorten dieser Art.
        </p>
        <ul className="divide-y divide-stone-100">
          {kinds.map((k) => (
            <KindRow key={k.key} kind={k} />
          ))}
        </ul>
      </section>
    </div>
  );
}
