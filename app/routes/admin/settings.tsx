import { data, Form } from "react-router";
import { currentUser } from "~/lib/session.server";
import { unsupportedChars } from "~/label/text";
import { audit } from "~/models/audit.server";
import { getSettings, saveSettings } from "~/models/settings.server";
import type { Route } from "./+types/settings";

export function meta() {
  return [{ title: "Einstellungen · Tee-Etiketten" }];
}

export function loader() {
  return { settings: getSettings() };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = currentUser(context);
  const form = await request.formData();
  const str = (k: string, max: number) => String(form.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const shop = { name: str("name", 60), url: str("url", 80), address: str("address", 120), organicCode: str("organicCode", 30) };
  const bad = unsupportedChars(Object.values(shop).join(""));
  if (bad.length) return data({ error: `Diese Zeichen können nicht gedruckt werden: ${bad.join(" ")}`, saved: false }, { status: 400 });
  if (shop.organicCode && !/^[A-Z]{2}-[A-ZÖÄÜ]{2,4}-\d{2,3}$/i.test(shop.organicCode)) {
    return data({ error: "Öko-Kontrollstelle im Format DE-ÖKO-006 angeben.", saved: false }, { status: 400 });
  }
  saveSettings({ shop, overflowPolicy: form.get("overflowPolicy") === "warn" ? "warn" : "block" });
  audit(user.username, "ändern", "einstellungen", null, `${shop.name} · ${shop.url}`);
  return { error: undefined, saved: true };
}

export default function Settings({ loaderData, actionData }: Route.ComponentProps) {
  const s = loaderData.settings;
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="font-display text-3xl tracking-wide uppercase">Einstellungen</h1>
      {actionData?.saved ? <p className="rounded-lg bg-brand-50 px-4 py-2 text-brand-800">Gespeichert.</p> : null}
      <Form method="post" className="card space-y-5">
        <h2 className="font-display text-lg tracking-wide uppercase">Fußzeile auf jedem Etikett</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="name">
              Shopname
            </label>
            <input id="name" name="name" defaultValue={s.shop.name} maxLength={60} className="field-input" />
          </div>
          <div>
            <label className="field-label" htmlFor="url">
              Internetadresse
            </label>
            <input id="url" name="url" defaultValue={s.shop.url} maxLength={80} className="field-input" />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="address">
              Anschrift (optional, zweite Zeile)
            </label>
            <input id="address" name="address" defaultValue={s.shop.address} maxLength={120} placeholder="z. B. Musterstraße 1, 12345 Musterstadt" className="field-input" />
          </div>
          <div>
            <label className="field-label" htmlFor="organicCode">
              Öko-Kontrollstelle (für Bio-Tees)
            </label>
            <input id="organicCode" name="organicCode" defaultValue={s.shop.organicCode} maxLength={30} placeholder="DE-ÖKO-006" className="field-input" />
          </div>
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
        {actionData?.error ? <p className="field-error">{actionData.error}</p> : null}
        <button className="btn-primary">Speichern</button>
      </Form>
    </div>
  );
}
