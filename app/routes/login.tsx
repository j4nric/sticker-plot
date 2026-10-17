import { data, Form, redirect, useNavigation } from "react-router";
import { lockedMinutes, loginKeys, registerFailure, registerSuccess } from "~/lib/rate-limit.server";
import { getSessionUser, loginCookie, safeRedirectTarget } from "~/lib/session.server";
import { audit } from "~/models/audit.server";
import { authenticate } from "~/models/user.server";
import type { Route } from "./+types/login";

export function meta() {
  return [{ title: "Anmelden · Tee-Etiketten" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const redirectTo = safeRedirectTarget(url.searchParams.get("redirectTo"));
  if (await getSessionUser(request)) throw redirect(redirectTo);
  return { redirectTo };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const redirectTo = safeRedirectTarget(String(form.get("redirectTo") ?? ""));
  const keys = loginKeys(request, username);

  const locked = lockedMinutes(keys);
  if (locked) return data({ error: `Zu viele Fehlversuche. Bitte in ${locked} Minute${locked === 1 ? "" : "n"} erneut versuchen.`, username }, { status: 429 });

  const user = authenticate(username, password);
  if (!user) {
    registerFailure(keys);
    await new Promise((r) => setTimeout(r, 500));
    return data({ error: "Benutzername oder Passwort ist falsch.", username }, { status: 401 });
  }
  registerSuccess(keys);
  audit(user.username, "anmelden", "benutzer", user.id);
  throw redirect(redirectTo, { headers: { "Set-Cookie": await loginCookie(request, user) } });
}

export default function Login({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Form method="post" className="card w-full max-w-sm space-y-4">
        <h1 className="font-display text-2xl tracking-wide uppercase">Tee-Etiketten</h1>
        <p className="text-sm text-stone-600">Bitte anmelden.</p>
        <input type="hidden" name="redirectTo" value={loaderData.redirectTo} />
        <div>
          <label className="field-label" htmlFor="username">
            Benutzername
          </label>
          <input id="username" name="username" autoComplete="username" required autoFocus defaultValue={actionData?.username} className="field-input" autoCapitalize="none" />
        </div>
        <div>
          <label className="field-label" htmlFor="password">
            Passwort
          </label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="field-input" />
          {actionData?.error ? <p className="field-error">{actionData.error}</p> : null}
        </div>
        <button className="btn-primary w-full" disabled={navigation.state !== "idle"}>
          Anmelden
        </button>
      </Form>
    </main>
  );
}
