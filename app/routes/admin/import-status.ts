import { data } from "react-router";
import { kickQueue } from "~/lib/import/queue.server";
import { currentUser } from "~/lib/session.server";
import { addImportItem, importCounts } from "~/models/import.server";
import type { Route } from "./+types/import-status";

const MAX_PDF_BYTES = 40 * 1024 * 1024;

/** Stand der Warteschlange (für die Fortschrittsanzeige). */
export function loader() {
  void kickQueue();
  return Response.json(importCounts());
}

/** Eine PDF-Datei entgegennehmen (der Browser lädt Dateien einzeln hoch). */
export async function action({ request, context }: Route.ActionArgs) {
  const user = currentUser(context);
  const form = await request.formData();
  const file = form.get("pdf");
  if (!(file instanceof File) || file.size === 0) return data({ error: "Keine Datei" }, { status: 400 });
  if (file.size > MAX_PDF_BYTES) return data({ error: `${file.name}: größer als 40 MB` }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") return data({ error: `${file.name}: keine PDF-Datei` }, { status: 400 });
  const id = addImportItem(file.name.slice(0, 200), buf, user.username);
  void kickQueue();
  return Response.json({ id });
}
