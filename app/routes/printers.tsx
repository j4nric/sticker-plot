import { data, Form, Link, redirect } from "react-router";
import { currentUser } from "~/lib/session.server";
import { audit } from "~/models/audit.server";
import { createPrinter, listPrinters } from "~/models/printer.server";
import { formatNumber, formatSigned } from "~/lib/locale";
import type { Route } from "./+types/printers";

export function meta() {
  return [{ title: "Drucker · Tee-Etiketten" }];
}

export function loader() {
  return { printers: listPrinters() };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = currentUser(context);
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 60) return data({ error: "Bitte einen Namen mit höchstens 60 Zeichen eingeben." }, { status: 400 });
  const printer = createPrinter(name);
  audit(user.username, "anlegen", "drucker", printer.id, name);
  throw redirect(`/drucker/${printer.id}`);
}

export default function Printers({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl tracking-wide uppercase">Drucker</h1>
      <p className="max-w-3xl text-stone-700">
        Jeder Drucker zieht das Papier etwas anders ein. Pro Drucker wird deshalb eine Korrektur gespeichert, die beim Erstellen der
        PDFs automatisch angewendet wird. Einmal mit dem Testbogen einrichten, danach sitzen alle Drucke.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loaderData.printers.map((p) => {
          const calibrated = p.offsetX !== 0 || p.offsetY !== 0 || p.scaleX !== 1 || p.scaleY !== 1;
          return (
            <li key={p.id}>
              <Link to={`/drucker/${p.id}`} className="card block transition hover:border-brand-600 hover:shadow-md">
                <span className="flex items-center gap-2">
                  <span className="font-display text-lg tracking-wide uppercase">{p.name}</span>
                  {p.isDefault ? <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">Standard</span> : null}
                </span>
                <span className="mt-1 block text-sm text-stone-600">
                  {calibrated
                    ? `X ${formatSigned(p.offsetX)} mm · Y ${formatSigned(p.offsetY)} mm · ${formatNumber(p.scaleX * 100)} % / ${formatNumber(p.scaleY * 100)} %`
                    : "noch nicht kalibriert"}
                </span>
                <span className="mt-2 block text-sm font-semibold text-brand-700">Kalibrieren ›</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Form method="post" className="card flex max-w-xl flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label className="field-label" htmlFor="name">
            Weiteren Drucker hinzufügen
          </label>
          <input id="name" name="name" required maxLength={60} placeholder="z. B. Büro-Laserdrucker" className="field-input" />
          {actionData?.error ? <p className="field-error">{actionData.error}</p> : null}
        </div>
        <button className="btn-secondary">Hinzufügen</button>
      </Form>
    </div>
  );
}
