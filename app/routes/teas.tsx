import { Form, Link, useSearchParams, useSubmit } from "react-router";
import { formatDate } from "~/lib/locale";
import { getKindSettings } from "~/models/settings.server";
import { isTeaSort, TEA_SORTS } from "~/lib/tea-sort";
import { countArchived, listTeas, teaColor } from "~/models/tea.server";
import type { Route } from "./+types/teas";

export function meta() {
  return [{ title: "Tees · Tee-Etiketten" }];
}

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const archived = url.searchParams.get("archiv") === "1";
  const sortParam = url.searchParams.get("sortierung");
  const sort = isTeaSort(sortParam) ? sortParam : "name";
  const kinds = getKindSettings();
  const teas = listTeas({ query: q, archived, sort }).map((t) => ({ ...t, color: teaColor(t, kinds) }));
  return { teas, q, archived, sort, archivedCount: countArchived() };
}

export default function Teas({ loaderData }: Route.ComponentProps) {
  const { teas, q, archived, sort, archivedCount } = loaderData;
  const [params] = useSearchParams();
  const submit = useSubmit();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl tracking-wide uppercase">{archived ? "Archiv" : "Tees"}</h1>
        <span className="text-stone-500">{teas.length} Sorten</span>
        {!archived ? (
          <Link to="/tees/neu" className="btn-primary ml-auto">
            + Neuer Tee
          </Link>
        ) : null}
      </div>

      <Form method="get" className="flex flex-wrap items-end gap-3" role="search" onChange={(e) => e.target instanceof HTMLSelectElement && submit(e.currentTarget)}>
        {archived ? <input type="hidden" name="archiv" value="1" /> : null}
        <div className="min-w-64 flex-1">
          <label className="sr-only" htmlFor="q">
            Suche
          </label>
          <input id="q" type="search" name="q" defaultValue={params.get("q") ?? ""} placeholder="Name, Teeart oder Text suchen" className="field-input" />
        </div>
        <button className="btn-secondary">Suchen</button>
        <div>
          <label className="sr-only" htmlFor="sortierung">
            Sortierung
          </label>
          <select id="sortierung" name="sortierung" defaultValue={sort} key={sort} className="field-input">
            {Object.entries(TEA_SORTS).map(([value, label]) => (
              <option key={value} value={value}>
                Sortierung: {label}
              </option>
            ))}
          </select>
        </div>
      </Form>

      <p>
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
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teas.map((t) => (
            <li key={t.id}>
              <Link to={`/tees/${t.id}`} className={`card flex min-h-28 items-center gap-4 transition hover:border-brand-600 hover:shadow-md ${archived ? "opacity-75" : ""}`}>
                <span className="size-12 flex-none rounded-full ring-4 ring-stone-100" style={{ background: t.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-xl tracking-wide uppercase">{t.name}</span>
                  {t.title && t.title !== t.name ? <span className="block truncate text-stone-500">Etikett: {t.title.replace(/\n/g, " ")}</span> : null}
                  <span className="block truncate text-stone-700">{t.teaType || "ohne Teeart"}</span>
                  <span className="block text-sm text-stone-500">
                    {t.lastPrintedAt ? `zuletzt gedruckt ${formatDate(t.lastPrintedAt)}` : "noch nie gedruckt"}
                  </span>
                </span>
                <span className="font-semibold text-brand-700">{archived ? "Öffnen ›" : "Drucken ›"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
