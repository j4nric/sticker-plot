import { data, Form } from "react-router";
import { currentUser, loginCookie } from "~/lib/session.server";
import { passwordRule } from "~/lib/validation";
import { audit } from "~/models/audit.server";
import { getUser, setPassword } from "~/models/user.server";
import { verifyPassword } from "~/lib/password.server";
import { Notice } from "~/components/Notice";
import type { Route } from "./+types/account";

export function meta() {
  return [{ title: "Mein Konto · Tee-Etiketten" }];
}

export function loader({ context }: Route.LoaderArgs) {
  return { user: currentUser(context) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = currentUser(context);
  const form = await request.formData();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const repeat = String(form.get("repeat") ?? "");
  const row = getUser(user.id)!;
  if (!verifyPassword(current, row.passwordHash)) return data({ error: "Das aktuelle Passwort ist falsch.", ok: false }, { status: 400 });
  const rule = passwordRule.safeParse(next);
  if (!rule.success) return data({ error: rule.error.issues[0]!.message, ok: false }, { status: 400 });
  if (next !== repeat) return data({ error: "Die neuen Passwörter stimmen nicht überein.", ok: false }, { status: 400 });
  setPassword(user.id, next);
  audit(user.username, "passwort ändern", "benutzer", user.id);
  // Andere Geräte werden abgemeldet, dieses bleibt angemeldet
  return data({ error: undefined, ok: true }, { headers: { "Set-Cookie": await loginCookie(request, getUser(user.id)!) } });
}

export default function Account({ loaderData, actionData }: Route.ComponentProps) {
  const { user } = loaderData;
  return (
    <div className="max-w-md space-y-5">
      <h1 className="font-display text-3xl tracking-wide uppercase">Mein Konto</h1>
      <p className="text-stone-700">
        Angemeldet als <b>{user.displayName}</b> ({user.username}), Rolle {user.role === "admin" ? "Administrator" : "Personal"}.
      </p>
      <Form method="post" className="card space-y-4" key={actionData?.ok ? "ok" : "form"}>
        <h2 className="font-display text-lg tracking-wide uppercase">Passwort ändern</h2>
        {actionData?.ok ? <Notice>Passwort geändert.</Notice> : null}
        <div>
          <label className="field-label" htmlFor="current">
            Aktuelles Passwort
          </label>
          <input id="current" name="current" type="password" autoComplete="current-password" required className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="next">
            Neues Passwort
          </label>
          <input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="repeat">
            Neues Passwort wiederholen
          </label>
          <input id="repeat" name="repeat" type="password" autoComplete="new-password" minLength={8} required className="field-input" />
          {actionData?.error ? <p className="field-error">{actionData.error}</p> : null}
        </div>
        <button className="btn-primary">Passwort speichern</button>
      </Form>
    </div>
  );
}
