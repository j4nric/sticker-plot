import { Link } from "react-router";
import { FONTS, VARIANTS } from "~/label/template";
import { listTemplates } from "~/models/template.server";
import type { Route } from "./+types/templates";

export function meta() {
  return [{ title: "Vorlagen · Tee-Etiketten" }];
}

export function loader() {
  return { templates: listTemplates() };
}

export default function Templates({ loaderData }: Route.ComponentProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl tracking-wide uppercase">Vorlagen</h1>
        <Link to="/verwaltung/vorlagen/neu" className="btn-primary ml-auto">
          + Neue Vorlage
        </Link>
      </div>
      <p className="max-w-3xl text-stone-700">
        Vorlagen legen die Gestaltung fest. Jede Sorte nutzt die Standardvorlage, außer im Tee-Editor ist eine andere gewählt, z. B. für saisonale Mischungen.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loaderData.templates.map((t) => (
          <li key={t.id}>
            <Link to={`/verwaltung/vorlagen/${t.id}`} className="card block h-full transition hover:border-brand-600 hover:shadow-md">
              <span className="flex items-center gap-2">
                <span className="font-display text-lg tracking-wide uppercase">{t.name}</span>
                {t.isDefault ? <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">Standard</span> : null}
              </span>
              <span className="mt-1 block text-sm text-stone-600">{VARIANTS[t.params.variant]}</span>
              <span className="block text-xs text-stone-500">Titel: {FONTS[t.params.titleFont].label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
