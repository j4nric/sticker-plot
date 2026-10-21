import { data } from "react-router";
import { printErrorResponse, pdfResponse, printLabels } from "~/lib/print.server";
import { currentUser } from "~/lib/session.server";
import { parseMixedItems, readPrintQuery } from "~/lib/validation";
import type { Route } from "./+types/mixed-pdf";

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = currentUser(context);
  const url = new URL(request.url);
  const lines = parseMixedItems(url.searchParams.get("items"));
  if (!lines) throw data("Ungültige Auswahl", { status: 400 });
  const query = readPrintQuery(url);
  if (!query) throw data("Ungültige Druckangaben", { status: 400 });
  const outcome = await printLabels({ ...query, lines, user, title: "Sammeldruck – Etiketten" });
  if (!outcome.ok) return printErrorResponse(outcome, request);
  return pdfResponse(outcome.pdf, "sammeldruck-etiketten.pdf");
}
