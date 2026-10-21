import { data } from "react-router";
import { printErrorResponse, pdfResponse, printLabels } from "~/lib/print.server";
import { currentUser } from "~/lib/session.server";
import { fileSlug } from "~/lib/slug";
import { parseId } from "~/lib/params";
import { readPrintQuery } from "~/lib/validation";
import { getTea } from "~/models/tea.server";
import type { Route } from "./+types/tea-pdf";

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const user = currentUser(context);
  const tea = getTea(parseId(params.teaId));
  if (!tea) throw data("Tee nicht gefunden", { status: 404 });
  const query = readPrintQuery(new URL(request.url));
  if (!query) throw data("Ungültige Druckangaben", { status: 400 });
  const outcome = await printLabels({ ...query, lines: [{ teaId: tea.id, count: query.count }], user, title: `${tea.name} – Etiketten` });
  if (!outcome.ok) return printErrorResponse(outcome, request);
  return pdfResponse(outcome.pdf, `${fileSlug(tea.name)}-etiketten.pdf`);
}
