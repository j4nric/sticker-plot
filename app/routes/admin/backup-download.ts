import { readFileSync, rmSync } from "node:fs";
import { data } from "react-router";
import { backupPath, createBackup } from "~/lib/backup.server";
import { currentUser } from "~/lib/session.server";
import { audit } from "~/models/audit.server";
import type { Route } from "./+types/backup-download";

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = currentUser(context);
  const name = new URL(request.url).searchParams.get("datei");
  let file: string;
  let temporary = false;
  if (name) {
    const p = backupPath(name);
    if (!p) throw data("Sicherung nicht gefunden", { status: 404 });
    file = p;
  } else {
    file = await createBackup("download");
    temporary = true;
  }
  const buf = readFileSync(file);
  if (temporary) rmSync(file, { force: true });
  audit(user.username, "sicherung herunterladen", "datenbank", null, name ?? "aktueller Stand");
  const downloadName = name ?? `tee-etiketten-${new Date().toISOString().slice(0, 10)}.db`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
      "Cache-Control": "no-store",
    },
  });
}
