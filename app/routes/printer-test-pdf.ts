import { data } from "react-router";
import { htmlToPdf } from "~/lib/pdf.server";
import { pdfResponse } from "~/lib/print.server";
import { testSheetHtml } from "~/lib/render.server";
import { fileSlug } from "~/lib/slug";
import { resolveFormat } from "~/models/format.server";
import { getPrinter, toCalibration } from "~/models/printer.server";
import { parseId } from "~/lib/params";
import type { Route } from "./+types/printer-test-pdf";

export async function loader({ params, request }: Route.LoaderArgs) {
  const printer = getPrinter(parseId(params.printerId));
  if (!printer) throw data("Drucker nicht gefunden", { status: 404 });
  const format = resolveFormat(Number(new URL(request.url).searchParams.get("format")) || undefined);
  const html = testSheetHtml({ calibration: toCalibration(printer), printerName: printer.name, format, formatName: format.name });
  const { pdf } = await htmlToPdf(html, { pageWidth: format.pageWidth, pageHeight: format.pageHeight, title: `Testbogen ${printer.name}` });
  return pdfResponse(pdf, `testbogen-${fileSlug(printer.name)}.pdf`);
}
