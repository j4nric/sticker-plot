import type { Tea } from "~/db/schema";
import type { KindLook, TeaFormValues } from "~/components/TeaEditor";
import { listFormats } from "~/models/format.server";
import { listPrinters } from "~/models/printer.server";
import { getSettings, type KindSettings } from "~/models/settings.server";
import { listTemplates } from "~/models/template.server";

/** Gemeinsame Daten für Editor, Vorschau und Druckfeld. */
export function editorData() {
  const settings = getSettings();
  return {
    shop: settings.shop,
    kinds: kindLook(settings.kinds),
    templates: listTemplates(),
    formats: listFormats(),
    printers: listPrinters().map((p) => ({ id: p.id, name: p.name, isDefault: p.isDefault, nextSlot: p.nextSlot })),
  };
}

/** Farbe und Motiv-URL je Teeart für Editor und Vorschau. */
export function kindLook(kinds: KindSettings): KindLook {
  return Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, { color: v.color, imageSrc: v.imageId ? `/bilder/${v.imageId}` : null }]));
}

export function teaToForm(t: Tea): TeaFormValues {
  return {
    name: t.name,
    title: t.title,
    kind: t.kind,
    flavored: t.flavored,
    description: t.description,
    ingredients: t.ingredients,
    motif: t.motif,
    templateId: t.templateId ? String(t.templateId) : "",
    brewAmount: t.brewAmount,
    brewTemp: t.brewTemp ? String(t.brewTemp) : "",
    brewTime: t.brewTime,
    organic: t.organic,
    ean: t.ean,
    productUrl: t.productUrl,
    price: t.price,
    shelfLifeMonths: t.shelfLifeMonths ? String(t.shelfLifeMonths) : "",
  };
}

/** Formularwerte nach fehlgeschlagener Prüfung wieder anzeigen. */
export function rawToForm(raw: Record<string, unknown>): TeaFormValues {
  const s = (k: string) => (raw[k] == null ? "" : String(raw[k]));
  return {
    name: s("name"),
    title: s("title"),
    kind: s("kind"),
    flavored: raw.flavored === true,
    description: s("description"),
    ingredients: s("ingredients"),
    motif: s("motif") || "auto",
    templateId: s("templateId"),
    brewAmount: s("brewAmount"),
    brewTemp: s("brewTemp"),
    brewTime: s("brewTime"),
    organic: raw.organic === true,
    ean: s("ean"),
    productUrl: s("productUrl"),
    price: s("price"),
    shelfLifeMonths: s("shelfLifeMonths"),
  };
}
