import { data, Form, redirect, useNavigation } from "react-router";
import { createBackup, listBackups, restoreDatabase } from "~/lib/backup.server";
import { currentUser, destroySession, getSession } from "~/lib/session.server";
import { audit } from "~/models/audit.server";
import { formatDateTime } from "~/lib/locale";
import type { Route } from "./+types/backup";

export function meta() {
  return [{ title: "Sicherung · Tee-Etiketten" }];
}

export function loader() {
  return { backups: listBackups().slice(0, 60) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = currentUser(context);
  const form = await request.formData();
  if (form.get("intent") === "create") {
    const file = await createBackup("manuell");
    audit(user.username, "sicherung erstellen", "datenbank", null, file.split("/").at(-1));
    return { ok: "Sicherung erstellt.", error: undefined };
  }
  if (form.get("intent") === "restore") {
    if (form.get("confirm") !== "WIEDERHERSTELLEN") return data({ ok: undefined, error: "Zur Bestätigung WIEDERHERSTELLEN eintippen." }, { status: 400 });
    const file = form.get("datei");
    if (!(file instanceof File) || file.size === 0) return data({ ok: undefined, error: "Bitte eine Sicherungsdatei auswählen." }, { status: 400 });
    if (file.size > 500 * 1024 * 1024) return data({ ok: undefined, error: "Die Datei ist zu groß." }, { status: 400 });
    const result = await restoreDatabase(Buffer.from(await file.arrayBuffer()));
    if (!result.ok) return data({ ok: undefined, error: result.error }, { status: 400 });
    // Benutzer der wiederhergestellten Datenbank können andere sein: neu anmelden
    audit(user.username, "sicherung wiederherstellen", "datenbank", null, `${file.name}, vorheriger Stand: ${result.safety}`);
    throw redirect("/login", { headers: { "Set-Cookie": await destroySession(await getSession(request)) } });
  }
  throw data("Unbekannte Aktion", { status: 400 });
}

const size = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`);

export default function Backup({ loaderData, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="font-display text-3xl tracking-wide uppercase">Sicherung</h1>
      <p className="text-stone-700">
        Alle Daten liegen in einer einzigen Datenbankdatei, auch hochgeladene Bilder. Der Server sichert täglich automatisch. Für eine zusätzliche Kopie die
        Datenbank herunterladen und z. B. auf einem Stick oder in der Cloud ablegen.
      </p>
      {actionData?.ok ? <p className="rounded-lg bg-brand-50 px-4 py-2 text-brand-800">{actionData.ok}</p> : null}
      {actionData?.error ? <p className="field-error">{actionData.error}</p> : null}

      <section className="card flex flex-wrap items-center gap-3">
        <a href="/verwaltung/sicherung/datenbank.sqlite" className="btn-primary">
          Aktuelle Datenbank herunterladen
        </a>
        <Form method="post">
          <button className="btn-secondary" name="intent" value="create" disabled={busy}>
            Sicherung auf dem Server anlegen
          </button>
        </Form>
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-lg tracking-wide uppercase">Sicherungen auf dem Server</h2>
        {loaderData.backups.length ? (
          <ul className="divide-y divide-stone-100 text-sm">
            {loaderData.backups.map((b) => (
              <li key={b.name} className="flex flex-wrap items-center gap-3 py-2">
                <span className="flex-1 font-mono text-xs">{b.name}</span>
                <span className="text-stone-500">{formatDateTime(b.modified)}</span>
                <span className="w-16 text-right text-stone-500">{size(b.size)}</span>
                <a className="text-brand-700 underline" href={`/verwaltung/sicherung/datenbank.sqlite?datei=${encodeURIComponent(b.name)}`}>
                  Herunterladen
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-500">Noch keine Sicherungen vorhanden.</p>
        )}
      </section>

      <section className="card space-y-3 border-red-200">
        <h2 className="font-display text-lg tracking-wide uppercase">Sicherung wiederherstellen</h2>
        <p className="text-sm text-stone-700">
          Ersetzt <b>alle</b> aktuellen Daten durch die gewählte Sicherung. Der aktuelle Stand wird vorher automatisch als Sicherung abgelegt. Danach ist eine neue
          Anmeldung nötig.
        </p>
        <Form method="post" encType="multipart/form-data" className="flex flex-wrap items-end gap-3">
          <input type="file" name="datei" accept=".db,.sqlite,application/octet-stream" required className="text-sm" />
          <div>
            <label className="field-label" htmlFor="confirm">
              Zur Bestätigung WIEDERHERSTELLEN eintippen
            </label>
            <input id="confirm" name="confirm" autoComplete="off" className="field-input w-56" />
          </div>
          <button className="btn-danger" name="intent" value="restore" disabled={busy}>
            Wiederherstellen
          </button>
        </Form>
      </section>
    </div>
  );
}
