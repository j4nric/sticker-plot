import { data } from "react-router";
import { getImage } from "~/models/image.server";
import type { Route } from "./+types/image";

export function loader({ params }: Route.LoaderArgs) {
  const img = getImage(Number(params.imageId));
  if (!img) throw data("Bild nicht gefunden", { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      // SVGs nicht als Dokument mit Skripten ausführen lassen
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
