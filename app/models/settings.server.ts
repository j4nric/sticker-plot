import { eq } from "drizzle-orm";
import { db } from "~/db/db.server";
import { settings } from "~/db/schema";
import type { FooterSeparator, ShopInfo } from "~/label/Label";

const SEPARATORS: FooterSeparator[] = ["blatt", "punkt", "strich", "keins"];

export interface AppSettings {
  shop: Required<ShopInfo>;
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
  };
}

export function saveSettings(s: AppSettings) {
  write("shop", s.shop);
  write("overflowPolicy", s.overflowPolicy);
}
