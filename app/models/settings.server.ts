import { eq } from "drizzle-orm";
import { db } from "~/db/db.server";
import { settings } from "~/db/schema";
import { isHexColor } from "~/label/color";
import type { FooterSeparator, ShopInfo } from "~/label/Label";
import { TEA_KIND_KEYS, TEA_KINDS, type TeaKind } from "~/label/tea-types";

const SEPARATORS: FooterSeparator[] = ["blatt", "punkt", "strich", "keins"];

/** Zentrale Gestaltung je Teeart: feste Farbe und optional ein eigenes Motiv-Bild. */
export type KindSettings = Record<TeaKind, { color: string; imageId: number | null }>;

export interface AppSettings {
  shop: Required<ShopInfo>;
  kinds: KindSettings;
  /** block = PDF wird bei zu langem Text verweigert, warn = nur Hinweis */
  overflowPolicy: "block" | "warn";
}

function read<T>(key: string, fallback: T): T {
  const row = db().select().from(settings).where(eq(settings.key, key)).get();
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  db()
    .insert(settings)
    .values({ key, value: JSON.stringify(value) })
    .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(value) } })
    .run();
}

export function getSettings(): AppSettings {
  const shop = read<Partial<ShopInfo>>("shop", {});
  return {
    shop: {
      name: shop.name ?? "",
      url: shop.url ?? "",
      address: shop.address ?? "",
      organicCode: shop.organicCode ?? "",
      separator: SEPARATORS.includes(shop.separator as FooterSeparator) ? (shop.separator as FooterSeparator) : "blatt",
      footerItalic: shop.footerItalic !== false,
    },
    overflowPolicy: read<string>("overflowPolicy", "block") === "warn" ? "warn" : "block",
    kinds: getKindSettings(),
  };
}

export function getKindSettings(): KindSettings {
  const stored = read<Partial<Record<string, { color?: unknown; imageId?: unknown }>>>("kinds", {});
  return Object.fromEntries(
    TEA_KIND_KEYS.map((k) => {
      const v = stored[k] ?? {};
      return [
        k,
        {
          color: typeof v.color === "string" && isHexColor(v.color) ? v.color.toLowerCase() : TEA_KINDS[k].color,
          imageId: typeof v.imageId === "number" ? v.imageId : null,
        },
      ];
    }),
  ) as KindSettings;
}

export function saveKindSettings(kinds: KindSettings) {
  write("kinds", kinds);
}

export function saveSettings(s: Omit<AppSettings, "kinds">) {
  write("shop", s.shop);
  write("overflowPolicy", s.overflowPolicy);
}
