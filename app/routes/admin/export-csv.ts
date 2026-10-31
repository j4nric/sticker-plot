import { toCsv } from "~/lib/csv";
import { CSV_COLUMNS } from "~/lib/import/csv-import.server";
import { currentUser } from "~/lib/session.server";
import { audit } from "~/models/audit.server";
import { allTeas } from "~/models/tea.server";
import { listTemplates } from "~/models/template.server";
import type { Route } from "./+types/export-csv";

export function loader({ context }: Route.LoaderArgs) {
  const user = currentUser(context);
  const templates = new Map(listTemplates().map((t) => [t.id, t.name]));
  const teas = allTeas();
  const rows = [
    [...CSV_COLUMNS],
    ...teas.map((t) => [
      t.name,
      t.title,
      t.teaType,
      t.description,
      t.ingredients,
      t.motif,
      t.templateId ? (templates.get(t.templateId) ?? "") : "",
      t.brewAmount,
      t.brewTemp ?? "",
      t.brewTime,
      t.organic,
      t.ean,
      t.productUrl,
      t.price,
      t.shelfLifeMonths ?? "",
      Boolean(t.archivedAt),
    ]),
  ];
  audit(user.username, "export", "tee", null, `${teas.length} Sorten als CSV`);
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tees-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
