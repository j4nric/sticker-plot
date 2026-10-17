import { eq } from "drizzle-orm";
import { db } from "~/db/db.server";
import { images } from "~/db/schema";

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/** Erkennt das Bildformat an den ersten Bytes, nicht an der Dateiendung. */
export function sniffImageType(buf: Buffer): (typeof IMAGE_TYPES)[number] | null {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  const head = buf.subarray(0, 512).toString("utf8").trimStart();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "image/svg+xml";
  return null;
}

/** SVG-Dateien von Skripten und externen Verweisen befreien. */
export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|xlink:href)\s*=\s*("|')(?!#|data:image\/)[^"']*\2/gi, "");
}

export function saveImage(mime: string, data: Buffer): number {
  return db().insert(images).values({ mime, data }).returning({ id: images.id }).get().id;
}

export function getImage(id: number) {
  return db().select().from(images).where(eq(images.id, id)).get();
}

export function deleteImage(id: number) {
  db().delete(images).where(eq(images.id, id)).run();
}

/** Bild als data:-URL für das PDF (keine Netzwerkzugriffe im Renderer). */
export function imageDataUrl(id: number | null | undefined): string | null {
  if (!id) return null;
  const img = getImage(id);
  return img ? `data:${img.mime};base64,${img.data.toString("base64")}` : null;
}
