import { data } from "react-router";
import { printErrorResponse, pdfResponse, printLabels } from "~/lib/print.server";
import { currentUser } from "~/lib/session.server";
import { germanDate } from "~/lib/dates";
import { fileSlug } from "~/lib/slug";
import { printRequest } from "~/lib/validation";
import { getTea } from "~/models/tea.server";
import type { Route } from "./+types/tea-pdf";

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const user = currentUser(context);
  const tea = getTea(Number(params.teaId));
  if (!tea) throw data("Tee nicht gefunden", { status: 404 });
  const url = new URL(request.url);
  const query = Object.fromEntries([...url.searchParams].filter(([, v]) => v !== ""));
  const parsed = printRequest.safeParse(query);
  if (!parsed.success) throw data("Ungültige Druckangaben", { status: 400 });
  const q = parsed.data;
  const outcome = await printLabels({
    lines: [{ teaId: tea.id, count: q.anzahl }],
    printerId: q.drucker,
    formatId: q.format,
    start: q.start,
    extras: { netWeight: q.menge?.trim(), bestBefore: germanDate(q.mhd), lot: q.los?.trim() },
    force: q.trotzdem === "1",
    preview: url.searchParams.get("vorschau") === "1",
    user,
    title: `${tea.name} – Etiketten`,
  });
  if (!outcome.ok) return printErrorResponse(outcome, request);
  return pdfResponse(outcome.pdf, `${fileSlug(tea.name)}-etiketten.pdf`);
}
