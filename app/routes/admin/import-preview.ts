import { data } from "react-router";
import { getImage } from "~/models/image.server";
import { getImportItem } from "~/models/import.server";
import { parseId } from "~/lib/params";
import type { Route } from "./+types/import-preview";

export function loader({ params }: Route.LoaderArgs) {
  const item = getImportItem(parseId(params.itemId));
  const img = item?.previewImageId ? getImage(item.previewImageId) : undefined;
  if (!img) throw data("Keine Vorschau", { status: 404 });
  return new Response(new Uint8Array(img.data), { headers: { "Content-Type": img.mime, "Cache-Control": "private, max-age=3600" } });
}
