import { Form, Link, useSearchParams } from "react-router";
import { listTeas } from "~/models/tea.server";
import type { Route } from "./+types/teas";

export function meta() {
  return [{ title: "Tees · Tee-Etiketten" }];
}

export function loader({ request }: Route.LoaderArgs) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return { teas: listTeas(q), q };
}

const dateFmt = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

export default function Teas({ loaderData }: Route.ComponentProps) {
  const { teas, q } = loaderData;
  const [params] = useSearchParams();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl tracking-wide uppercase">Tees</h1>
        <Form method="get" className="ml-auto flex gap-2" role="search">
          <input type="search" name="q" defaultValue={params.get("q") ?? ""} placeholder="Name oder Teeart suchen" className="field-input w-64" aria-label="Suche" />
          <button className="btn-secondary">Suchen</button>
        </Form>
        <Link to="/tees/neu" className="btn-primary">
          + Neuer Tee
        </Link>
      </div>

      {teas.length === 0 ? (
        <div className="card text-center">
          {q ? (
            <p>
              Keine Tees zu „{q}“ gefunden. <Link className="text-brand-700 underline" to="/">Alle anzeigen</Link>
            </p>
          ) : (
            <>
              <p className="text-lg">Noch keine Tees angelegt.</p>
              <p className="mt-1 text-stone-600">Lege den ersten Tee an. Danach kannst du jederzeit Etiketten dafür drucken.</p>
              <Link to="/tees/neu" className="btn-primary mt-4">
                Ersten Tee anlegen
              </Link>
            </>
          )}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teas.map((t) => (
            <li key={t.id}>
              <Link to={`/tees/${t.id}`} className="card flex items-center gap-4 transition hover:border-brand-600 hover:shadow-md">
                <span className="size-10 flex-none rounded-full ring-4 ring-stone-100" style={{ background: t.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg tracking-wide uppercase">{t.name}</span>
                  <span className="block truncate text-sm text-stone-600">{t.teaType || "ohne Teeart"}</span>
                  <span className="block text-xs text-stone-500">
                    {t.lastPrintedAt ? `zuletzt gedruckt ${dateFmt.format(t.lastPrintedAt)}` : "noch nie gedruckt"}
                  </span>
                </span>
                <span className="text-sm font-semibold text-brand-700">Drucken ›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
