import { Form, Link, useSearchParams } from "react-router";
import { countArchived, listTeas } from "~/models/tea.server";
import { formatDate } from "~/lib/locale";
import type { Route } from "./+types/teas";

export function meta() {
  return [{ title: "Tees · Tee-Etiketten" }];
}

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const archived = url.searchParams.get("archiv") === "1";
  return { teas: listTeas({ query: q, archived }), q, archived, archivedCount: countArchived() };
}

export default function Teas({ loaderData }: Route.ComponentProps) {
  const { teas, q, archived, archivedCount } = loaderData;
  const [params] = useSearchParams();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl tracking-wide uppercase">{archived ? "Archiv" : "Tees"}</h1>
        <span className="text-sm text-stone-500">{teas.length} Sorten</span>
        <Form method="get" className="ml-auto flex gap-2" role="search">
          {archived ? <input type="hidden" name="archiv" value="1" /> : null}
          <input type="search" name="q" defaultValue={params.get("q") ?? ""} placeholder="Name, Teeart oder Text suchen" className="field-input w-64" aria-label="Suche" />
          <button className="btn-secondary">Suchen</button>
        </Form>
        {!archived ? (
          <Link to="/tees/neu" className="btn-primary">
            + Neuer Tee
          </Link>
        ) : null}
      </div>
      <p className="text-sm">
        {archived ? (
          <Link to="/" className="text-brand-700 underline">
            ‹ Zurück zu den aktiven Tees
          </Link>
        ) : archivedCount ? (
          <Link to="/?archiv=1" className="text-stone-600 underline">
            Archiv ansehen ({archivedCount})
          </Link>
        ) : null}
      </p>

      {teas.length === 0 ? (
        <div className="card text-center">
          {q ? (
            <p>
              Keine Tees zu „{q}“ gefunden.{" "}
              <Link className="text-brand-700 underline" to={archived ? "/?archiv=1" : "/"}>
                Alle anzeigen
              </Link>
            </p>
          ) : archived ? (
            <p>Das Archiv ist leer.</p>
          ) : (
            <>
              <p className="text-lg">Noch keine Tees angelegt.</p>
              <p className="mt-1 text-stone-600">Lege den ersten Tee an oder übernimm bestehende Etiketten über Verwaltung → Import.</p>
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
              <Link to={`/tees/${t.id}`} className={`card flex items-center gap-4 transition hover:border-brand-600 hover:shadow-md ${archived ? "opacity-75" : ""}`}>
                <span className="size-10 flex-none rounded-full ring-4 ring-stone-100" style={{ background: t.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg tracking-wide uppercase">{t.name}</span>
                  <span className="block truncate text-sm text-stone-600">{t.teaType || "ohne Teeart"}</span>
                  <span className="block text-xs text-stone-500">
                    {t.lastPrintedAt ? `zuletzt gedruckt ${formatDate(t.lastPrintedAt)}` : "noch nie gedruckt"}
                  </span>
                </span>
                <span className="text-sm font-semibold text-brand-700">{archived ? "Öffnen ›" : "Drucken ›"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
