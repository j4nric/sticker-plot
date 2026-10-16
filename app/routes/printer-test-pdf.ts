import { data } from "react-router";
import { htmlToPdf } from "~/lib/pdf.server";
import { testSheetHtml } from "~/lib/render.server";
import { fileSlug } from "~/lib/slug";
import { getPrinter, toCalibration } from "~/models/printer.server";
import type { Route } from "./+types/printer-test-pdf";

export async function loader({ params }: Route.LoaderArgs) {
  const printer = getPrinter(Number(params.printerId));
  if (!printer) throw data("Drucker nicht gefunden", { status: 404 });
  const { pdf } = await htmlToPdf(testSheetHtml({ calibration: toCalibration(printer), printerName: printer.name }));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="testbogen-${fileSlug(printer.name)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
