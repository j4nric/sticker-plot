import { data, redirect } from "react-router";
import { EMPTY_TEA, TeaEditor } from "~/components/TeaEditor";
import { editorData, rawToForm } from "~/lib/editor.server";
import { currentUser } from "~/lib/session.server";
import { readTeaForm } from "~/lib/validation";
import { audit } from "~/models/audit.server";
import { createTea } from "~/models/tea.server";
import type { Route } from "./+types/tea-new";

export function meta() {
  return [{ title: "Neuer Tee · Tee-Etiketten" }];
}

export function loader() {
  const d = editorData();
  return { shop: d.shop, templates: d.templates, format: d.formats[0]! };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = currentUser(context);
  const parsed = readTeaForm(await request.formData());
  if (!parsed.ok) return data({ errors: parsed.errors, values: rawToForm(parsed.raw) }, { status: 400 });
  const tea = createTea(parsed.value);
  audit(user.username, "anlegen", "tee", tea.id, tea.name);
  throw redirect(`/tees/${tea.id}?neu=1`);
}

export default function NewTea({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl tracking-wide uppercase">Neuer Tee</h1>
      <TeaEditor
        key={actionData ? "retry" : "new"}
        initial={actionData?.values ?? EMPTY_TEA}
        errors={actionData?.errors}
        shop={loaderData.shop}
        templates={loaderData.templates}
        format={loaderData.format}
        isNew
        renderAside={() => <div className="card text-sm text-stone-600">Nach dem Anlegen kannst du hier direkt Etiketten drucken und ein eigenes Bild hochladen.</div>}
      />
    </div>
  );
}
