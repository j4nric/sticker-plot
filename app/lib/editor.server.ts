import type { Tea } from "~/db/schema";
import type { TeaFormValues } from "~/components/TeaEditor";
import { listFormats } from "~/models/format.server";
import { listPrinters } from "~/models/printer.server";
import { getSettings } from "~/models/settings.server";
import { listTemplates } from "~/models/template.server";

/** Gemeinsame Daten für Editor, Vorschau und Druckfeld. */
export function editorData() {
  return {
    shop: getSettings().shop,
    templates: listTemplates(),
    formats: listFormats(),
    printers: listPrinters().map((p) => ({ id: p.id, name: p.name, isDefault: p.isDefault, nextSlot: p.nextSlot })),
  };
}

export function teaToForm(t: Tea): TeaFormValues {
  return {
    name: t.name,
    teaType: t.teaType,
    description: t.description,
    ingredients: t.ingredients,
    color: t.color,
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
    teaType: s("teaType"),
    description: s("description"),
    ingredients: s("ingredients"),
    color: s("color"),
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
