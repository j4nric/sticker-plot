import { Link } from "react-router";
import { labelsPerSheet } from "~/label/geometry";
import { listFormats } from "~/models/format.server";
import { formatCompact } from "~/lib/locale";
import type { Route } from "./+types/formats";

export function meta() {
  return [{ title: "Bogenformate · Tee-Etiketten" }];
}

export function loader() {
  return { formats: listFormats() };
}

export default function Formats({ loaderData }: Route.ComponentProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl tracking-wide uppercase">Bogenformate</h1>
        <Link to="/verwaltung/bogenformate/neu" className="btn-primary ml-auto">
          + Neues Format
        </Link>
      </div>
      <p className="max-w-3xl text-stone-700">
        Ein Bogenformat beschreibt Papiergröße und Etikettenraster. Das Etikett-Design passt sich an andere Etikettgrößen an, indem es gleichmäßig skaliert wird.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {loaderData.formats.map((f) => (
          <li key={f.id}>
            <Link to={`/verwaltung/bogenformate/${f.id}`} className="card block transition hover:border-brand-600 hover:shadow-md">
              <span className="flex items-center gap-2">
                <span className="font-display text-lg tracking-wide uppercase">{f.name}</span>
                {f.isDefault ? <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">Standard</span> : null}
              </span>
              <span className="mt-1 block text-sm text-stone-600">
                Seite {formatCompact(f.pageWidth)} × {formatCompact(f.pageHeight)} mm · {f.columns} × {f.rows} = {labelsPerSheet(f)} Etiketten à {formatCompact(f.labelWidth)} × {formatCompact(f.labelHeight)} mm
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
