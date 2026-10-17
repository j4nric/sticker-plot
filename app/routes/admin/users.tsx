import { data, Form, useNavigation } from "react-router";
import { currentUser } from "~/lib/session.server";
import { passwordRule, usernameRule } from "~/lib/validation";
import { audit } from "~/models/audit.server";
import { createUser, deleteUser, findUserByName, getUser, isLastActiveAdmin, listUsers, setPassword, updateUser } from "~/models/user.server";
import { formatDateTime } from "~/lib/locale";
import type { Route } from "./+types/users";

export function meta() {
  return [{ title: "Benutzer · Tee-Etiketten" }];
}

export function loader({ context }: Route.LoaderArgs) {
  const me = currentUser(context);
  return {
    me: me.id,
    users: listUsers().map((u) => ({ id: u.id, username: u.username, displayName: u.displayName, role: u.role, active: u.active, lastLoginAt: u.lastLoginAt })),
  };
}

type Result = { ok?: string; error?: string; userId?: number };

export async function action({ request, context }: Route.ActionArgs) {
  const me = currentUser(context);
  const form = await request.formData();
  const intent = form.get("intent");
  const role = form.get("role") === "admin" ? "admin" : "staff";
  const displayName = String(form.get("displayName") ?? "").trim().slice(0, 60);

  if (intent === "create") {
    const u = usernameRule.safeParse(String(form.get("username") ?? ""));
    if (!u.success) return data<Result>({ error: u.error.issues[0]!.message }, { status: 400 });
    if (findUserByName(u.data)) return data<Result>({ error: "Diesen Benutzernamen gibt es schon." }, { status: 400 });
    const pw = passwordRule.safeParse(String(form.get("password") ?? ""));
    if (!pw.success) return data<Result>({ error: pw.error.issues[0]!.message }, { status: 400 });
    const user = createUser({ username: u.data, displayName, role, password: pw.data });
    audit(me.username, "anlegen", "benutzer", user.id, `${user.username} (${role})`);
    return { ok: `Benutzer „${user.username}“ angelegt.` } as Result;
  }

  const id = Number(form.get("id"));
  const target = getUser(id);
  if (!target) throw data("Benutzer nicht gefunden", { status: 404 });

  if (intent === "update") {
    const active = form.get("active") === "on";
    if ((role !== "admin" || !active) && target.role === "admin" && isLastActiveAdmin(id)) {
      return data<Result>({ error: "Mindestens ein aktiver Administrator muss bleiben.", userId: id }, { status: 400 });
    }
    updateUser(id, { displayName, role, active });
    audit(me.username, "ändern", "benutzer", id, `${target.username}: ${role}, ${active ? "aktiv" : "deaktiviert"}`);
    return { ok: `„${target.username}“ gespeichert.`, userId: id } as Result;
  }
  if (intent === "password") {
    const pw = passwordRule.safeParse(String(form.get("password") ?? ""));
    if (!pw.success) return data<Result>({ error: pw.error.issues[0]!.message, userId: id }, { status: 400 });
    setPassword(id, pw.data);
    audit(me.username, "passwort setzen", "benutzer", id, target.username);
    return { ok: `Neues Passwort für „${target.username}“ gesetzt.`, userId: id } as Result;
  }
  if (intent === "delete") {
    if (id === me.id) return data<Result>({ error: "Das eigene Konto kann nicht gelöscht werden.", userId: id }, { status: 400 });
    if (target.role === "admin" && isLastActiveAdmin(id)) return data<Result>({ error: "Der letzte Administrator kann nicht gelöscht werden.", userId: id }, { status: 400 });
    deleteUser(id);
    audit(me.username, "löschen", "benutzer", id, target.username);
    return { ok: `„${target.username}“ gelöscht.` } as Result;
  }
  throw data("Unbekannte Aktion", { status: 400 });
}

export default function Users({ loaderData, actionData }: Route.ComponentProps) {
  const { users, me } = loaderData;
  const busy = useNavigation().state !== "idle";
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl tracking-wide uppercase">Benutzer</h1>
      <p className="max-w-3xl text-stone-700">
        <b>Personal</b> darf Tees anlegen, bearbeiten, archivieren, drucken und Drucker kalibrieren. <b>Administratoren</b> dürfen zusätzlich endgültig löschen und
        die Verwaltung nutzen.
      </p>
      {actionData?.ok ? <p className="rounded-lg bg-brand-50 px-4 py-2 text-brand-800">{actionData.ok}</p> : null}
      {actionData?.error && !actionData.userId ? <p className="field-error">{actionData.error}</p> : null}

      <ul className="space-y-3">
        {users.map((u) => (
          <li key={u.id} className="card space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-lg tracking-wide uppercase">{u.username}</span>
              {u.id === me ? <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs">du</span> : null}
              {!u.active ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">deaktiviert</span> : null}
              <span className="ml-auto text-xs text-stone-500">{u.lastLoginAt ? `zuletzt angemeldet ${formatDateTime(u.lastLoginAt)}` : "noch nie angemeldet"}</span>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Form method="post" className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={u.id} />
                <div>
                  <label className="field-label" htmlFor={`dn-${u.id}`}>
                    Anzeigename
                  </label>
                  <input id={`dn-${u.id}`} name="displayName" defaultValue={u.displayName} maxLength={60} className="field-input w-48" />
                </div>
                <div>
                  <label className="field-label" htmlFor={`role-${u.id}`}>
                    Rolle
                  </label>
                  <select id={`role-${u.id}`} name="role" defaultValue={u.role} className="field-input">
                    <option value="staff">Personal</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input type="checkbox" name="active" defaultChecked={u.active} className="size-4" />
                  aktiv
                </label>
                <button className="btn-secondary" name="intent" value="update" disabled={busy}>
                  Speichern
                </button>
              </Form>
              <Form method="post" className="flex items-end gap-2">
                <input type="hidden" name="id" value={u.id} />
                <div>
                  <label className="field-label" htmlFor={`pw-${u.id}`}>
                    Neues Passwort
                  </label>
                  <input id={`pw-${u.id}`} name="password" type="password" minLength={8} autoComplete="new-password" className="field-input w-44" required />
                </div>
                <button className="btn-secondary" name="intent" value="password" disabled={busy}>
                  Setzen
                </button>
              </Form>
              {u.id !== me ? (
                <Form method="post" onSubmit={(e) => !confirm(`Benutzer „${u.username}“ löschen?`) && e.preventDefault()}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className="btn-danger" name="intent" value="delete" disabled={busy}>
                    Löschen
                  </button>
                </Form>
              ) : null}
            </div>
            {actionData?.error && actionData.userId === u.id ? <p className="field-error">{actionData.error}</p> : null}
          </li>
        ))}
      </ul>

      <Form method="post" className="card flex flex-wrap items-end gap-3" key={actionData?.ok ?? "new"}>
        <h2 className="w-full font-display text-lg tracking-wide uppercase">Neuer Benutzer</h2>
        <div>
          <label className="field-label" htmlFor="username">
            Benutzername
          </label>
          <input id="username" name="username" required minLength={2} maxLength={32} autoCapitalize="none" className="field-input w-40" />
        </div>
        <div>
          <label className="field-label" htmlFor="displayName">
            Anzeigename
          </label>
          <input id="displayName" name="displayName" maxLength={60} className="field-input w-48" />
        </div>
        <div>
          <label className="field-label" htmlFor="role">
            Rolle
          </label>
          <select id="role" name="role" defaultValue="staff" className="field-input">
            <option value="staff">Personal</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="password">
            Passwort
          </label>
          <input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" className="field-input w-44" />
        </div>
        <button className="btn-primary" name="intent" value="create" disabled={busy}>
          Anlegen
        </button>
      </Form>
    </div>
  );
}
