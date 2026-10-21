import { and, eq, isNotNull, notInArray } from "drizzle-orm";
import { db } from "~/db/db.server";
import { images, importItems, teas } from "~/db/schema";

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
    // Verweise nur innerhalb der Datei oder auf eingebettete Bilder zulassen (mit und ohne Anführungszeichen)
    .replace(/\s(href|xlink:href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (attr, _name: string, value: string) =>
      /^["']?\s*(#|data:image\/(png|jpeg|webp|gif);)/i.test(value) ? attr : "",
    );
}

export function saveImage(mime: string, data: Buffer): number {
  return db().insert(images).values({ mime, data }).returning({ id: images.id }).get().id;
}

export function getImage(id: number) {
  return db().select().from(images).where(eq(images.id, id)).get();
}

/**
 * Löscht Bilder, auf die weder eine Sorte noch ein Importeintrag verweist.
 * Sorten können sich ein Bild teilen (Duplizieren), daher wird nie ein
 * einzelnes Bild direkt gelöscht.
 */
export function deleteUnusedImages(): number {
  const usedByTeas = db().select({ id: teas.imageId }).from(teas).where(isNotNull(teas.imageId));
  const usedByImports = db().select({ id: importItems.previewImageId }).from(importItems).where(isNotNull(importItems.previewImageId));
  return db()
    .delete(images)
    .where(and(notInArray(images.id, usedByTeas), notInArray(images.id, usedByImports)))
    .run().changes;
}

/** Bild als data:-URL für das PDF (keine Netzwerkzugriffe im Renderer). */
export function imageDataUrl(id: number | null | undefined): string | null {
  if (!id) return null;
  const img = getImage(id);
  return img ? `data:${img.mime};base64,${img.data.toString("base64")}` : null;
}
