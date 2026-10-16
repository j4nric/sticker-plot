import { data, redirect } from "react-router";
import { TeaEditor } from "~/components/TeaEditor";
import { env } from "~/lib/env.server";
import { readTeaForm } from "~/lib/validation";
import { DEFAULT_TEA_COLOR } from "~/label/tea-types";
import { createTea } from "~/models/tea.server";
import type { Route } from "./+types/tea-new";

export function meta() {
  return [{ title: "Neuer Tee · Tee-Etiketten" }];
}

export function loader() {
  return { shop: env.shop };
}

export async function action({ request }: Route.ActionArgs) {
  const parsed = readTeaForm(await request.formData());
  if (!parsed.ok) return data({ errors: parsed.errors, values: parsed.raw }, { status: 400 });
  const tea = createTea(parsed.value);
  throw redirect(`/tees/${tea.id}?neu=1#drucken`);
}

export default function NewTea({ loaderData, actionData }: Route.ComponentProps) {
  const initial = actionData?.values ?? { name: "", teaType: "", description: "", ingredients: "", color: DEFAULT_TEA_COLOR };
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl tracking-wide uppercase">Neuer Tee</h1>
      <TeaEditor
        key={actionData ? "retry" : "new"}
        initial={initial}
        errors={actionData?.errors}
        shop={loaderData.shop}
        isNew
        renderAside={() => (
          <div className="card text-sm text-stone-600">Nach dem Anlegen kannst du hier direkt Etiketten drucken.</div>
        )}
      />
    </div>
  );
}
