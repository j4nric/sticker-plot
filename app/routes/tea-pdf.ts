import { data } from "react-router";
import { env } from "~/lib/env.server";
import { htmlToPdf } from "~/lib/pdf.server";
import { fileSlug } from "~/lib/slug";
import { labelSheetsHtml } from "~/lib/render.server";
import { printRequest } from "~/lib/validation";
import { resolvePrinter, toCalibration } from "~/models/printer.server";
import { getTea, recordPrintJob } from "~/models/tea.server";
import type { Route } from "./+types/tea-pdf";

export async function loader({ params, request }: Route.LoaderArgs) {
  const tea = getTea(Number(params.teaId));
  if (!tea) throw data("Tee nicht gefunden", { status: 404 });

  const query = Object.fromEntries([...new URL(request.url).searchParams].filter(([, v]) => v !== ""));
  const parsed = printRequest.safeParse(query);
  if (!parsed.success) throw data("Ungültige Druckangaben", { status: 400 });

  const printer = resolvePrinter(parsed.data.drucker);
  const html = labelSheetsHtml({
    data: tea,
    shop: env.shop,
    calibration: toCalibration(printer),
    count: parsed.data.anzahl,
    start: parsed.data.start,
  });
  const { pdf } = await htmlToPdf(html);

  recordPrintJob({
    teaId: tea.id,
    teaName: tea.name,
    printerId: printer.id,
    labelCount: parsed.data.anzahl,
    startPosition: parsed.data.start,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileSlug(tea.name)}-etiketten.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
