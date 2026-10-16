import { data, Form, redirect, useNavigation } from "react-router";
import { checkPassword, commitSession, getSession, isLoggedIn, safeRedirectTarget } from "~/lib/session.server";
import type { Route } from "./+types/login";

export function meta() {
  return [{ title: "Anmelden · Tee-Etiketten" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  if (await isLoggedIn(request)) throw redirect(safeRedirectTarget(url.searchParams.get("redirectTo")));
  return { redirectTo: safeRedirectTarget(url.searchParams.get("redirectTo")) };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const redirectTo = safeRedirectTarget(String(form.get("redirectTo") ?? ""));
  if (!checkPassword(password)) {
    // kleine Bremse gegen Durchprobieren
    await new Promise((r) => setTimeout(r, 600));
    return data({ error: "Passwort ist falsch." }, { status: 401 });
  }
  const session = await getSession(request);
  session.set("loggedIn", true);
  throw redirect(redirectTo, { headers: { "Set-Cookie": await commitSession(session) } });
}

export default function Login({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Form method="post" className="card w-full max-w-sm space-y-4">
        <h1 className="font-display text-2xl tracking-wide uppercase">Tee-Etiketten</h1>
        <p className="text-sm text-stone-600">Bitte mit dem Laden-Passwort anmelden.</p>
        <input type="hidden" name="redirectTo" value={loaderData.redirectTo} />
        <div>
          <label className="field-label" htmlFor="password">
            Passwort
          </label>
          <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus className="field-input" />
          {actionData?.error ? <p className="field-error">{actionData.error}</p> : null}
        </div>
        <button className="btn-primary w-full" disabled={navigation.state !== "idle"}>
          Anmelden
        </button>
      </Form>
    </main>
  );
}
