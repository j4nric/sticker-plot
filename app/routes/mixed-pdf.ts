import { data } from "react-router";
import { germanDate } from "~/lib/dates";
import { printErrorResponse, pdfResponse, printLabels } from "~/lib/print.server";
import { currentUser } from "~/lib/session.server";
import { parseMixedItems, printRequest } from "~/lib/validation";
import type { Route } from "./+types/mixed-pdf";

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = currentUser(context);
  const url = new URL(request.url);
  const lines = parseMixedItems(url.searchParams.get("items"));
  if (!lines) throw data("Ungültige Auswahl", { status: 400 });
  const query = Object.fromEntries([...url.searchParams].filter(([k, v]) => v !== "" && k !== "items"));
  const parsed = printRequest.safeParse(query);
  if (!parsed.success) throw data("Ungültige Druckangaben", { status: 400 });
  const q = parsed.data;
  const outcome = await printLabels({
    lines,
    printerId: q.drucker,
    formatId: q.format,
    start: q.start,
    extras: { netWeight: q.menge?.trim(), bestBefore: germanDate(q.mhd), lot: q.los?.trim() },
    force: q.trotzdem === "1",
    preview: url.searchParams.get("vorschau") === "1",
    user,
    title: "Sammeldruck – Etiketten",
  });
  if (!outcome.ok) return printErrorResponse(outcome, request);
  return pdfResponse(outcome.pdf, "sammeldruck-etiketten.pdf");
}
