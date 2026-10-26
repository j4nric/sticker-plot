import { readTeaForm } from "~/lib/validation";
import { getImportItem, setItemStatus } from "~/models/import.server";
import { createTea, findTeaByName } from "~/models/tea.server";
import type { ImportResult } from "./interpret";

/** Übernimmt einen geprüften Import als neue Sorte (mit den ggf. korrigierten Feldern). */
export function acceptImport(
  itemId: number,
  fields: Pick<ImportResult, "name" | "kind" | "flavored" | "description" | "ingredients">,
  opts: { allowDuplicate?: boolean } = {},
): { ok: true; teaId: number } | { ok: false; error: string } {
  const item = getImportItem(itemId);
  if (!item || item.status !== "done") return { ok: false, error: "Dieser Eintrag ist nicht bereit zur Übernahme." };
  if (!opts.allowDuplicate && findTeaByName(fields.name)) return { ok: false, error: `„${fields.name}“ gibt es bereits.` };
  const form = new FormData();
  form.set("name", fields.name);
  form.set("kind", fields.kind);
  if (fields.flavored) form.set("flavored", "on");
  form.set("description", fields.description);
  form.set("ingredients", fields.ingredients);
  const parsed = readTeaForm(form);
  if (!parsed.ok) return { ok: false, error: Object.values(parsed.errors).join(" ") };
  const tea = createTea(parsed.value);
  setItemStatus(itemId, { status: "imported", teaId: tea.id });
  return { ok: true, teaId: tea.id };
}
