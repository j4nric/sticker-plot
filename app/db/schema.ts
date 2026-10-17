import { sql } from "drizzle-orm";
import { blob, index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { DEFAULT_TEA_COLOR } from "../label/tea-types";

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

/** Bilder (eigene Motive, Import-Vorschauen) liegen in der Datenbank, damit eine Sicherung alles enthält. */
export const images = sqliteTable("images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mime: text("mime").notNull(),
  data: blob("data", { mode: "buffer" }).notNull(),
  width: integer("width"),
  height: integer("height"),
  createdAt: createdAt(),
});

/** Gestaltungsvorlagen: Grundvariante plus einstellbare Parameter (JSON). */
export const templates = sqliteTable("templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  params: text("params").notNull().default("{}"),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Teesorten mit allen Texten, die auf das Etikett kommen. */
export const teas = sqliteTable("teas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  teaType: text("tea_type").notNull().default(""),
  description: text("description").notNull().default(""),
  ingredients: text("ingredients").notNull().default(""),
  color: text("color").notNull().default(DEFAULT_TEA_COLOR),
  motif: text("motif").notNull().default("auto"),
  imageId: integer("image_id").references(() => images.id, { onDelete: "set null" }),
  templateId: integer("template_id").references(() => templates.id, { onDelete: "set null" }),
  brewAmount: text("brew_amount").notNull().default(""),
  brewTemp: integer("brew_temp"),
  brewTime: text("brew_time").notNull().default(""),
  organic: integer("organic", { mode: "boolean" }).notNull().default(false),
  ean: text("ean").notNull().default(""),
  productUrl: text("product_url").notNull().default(""),
  price: text("price").notNull().default(""),
  shelfLifeMonths: integer("shelf_life_months"),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("teas_name_lower_idx").on(sql`lower(${t.name})`), index("teas_archived_idx").on(t.archivedAt)]);

/** Etikettenbögen: Seitengröße und Raster in mm. */
export const sheetFormats = sqliteTable("sheet_formats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  pageWidth: real("page_width").notNull(),
  pageHeight: real("page_height").notNull(),
  columns: integer("columns").notNull(),
  rows: integer("rows").notNull(),
  labelWidth: real("label_width").notNull(),
  labelHeight: real("label_height").notNull(),
  originX: real("origin_x").notNull(),
  originY: real("origin_y").notNull(),
  pitchX: real("pitch_x").notNull(),
  pitchY: real("pitch_y").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Drucker mit Kalibrierung (Versatz in mm, Skalierung als Faktor). */
export const printers = sqliteTable("printers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  offsetX: real("offset_x").notNull().default(0),
  offsetY: real("offset_y").notNull().default(0),
  scaleX: real("scale_x").notNull().default(1),
  scaleY: real("scale_y").notNull().default(1),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  /** erstes freies Feld des eingelegten Bogens, nach jedem Druck fortgeschrieben */
  nextSlot: integer("next_slot").notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Protokoll der erzeugten Etiketten-PDFs. */
export const printJobs = sqliteTable("print_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teaId: integer("tea_id").references(() => teas.id, { onDelete: "set null" }),
  teaName: text("tea_name").notNull(),
  printerId: integer("printer_id").references(() => printers.id, { onDelete: "set null" }),
  labelCount: integer("label_count").notNull(),
  startPosition: integer("start_position").notNull(),
  userName: text("user_name").notNull().default(""),
  createdAt: createdAt(),
}, (t) => [index("print_jobs_tea_created_idx").on(t.teaId, t.createdAt)]);

/** Schlüssel-Wert-Einstellungen (JSON-Werte). */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "staff"] }).notNull().default("staff"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Änderungsprotokoll: wer hat wann was geändert. */
export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userName: text("user_name").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id"),
  summary: text("summary").notNull().default(""),
  createdAt: createdAt(),
}, (t) => [index("audit_log_created_idx").on(t.createdAt)]);

/** Zwischenablage für den PDF-Import: erkannte Daten warten auf Prüfung. */
export const importItems = sqliteTable("import_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fileName: text("file_name").notNull(),
  status: text("status", { enum: ["queued", "processing", "done", "error", "imported", "skipped"] })
    .notNull()
    .default("queued"),
  error: text("error").notNull().default(""),
  /** Originaldatei bis zur Verarbeitung */
  source: blob("source", { mode: "buffer" }),
  /** erkannte Felder als JSON (ImportResult) */
  result: text("result").notNull().default(""),
  previewImageId: integer("preview_image_id").references(() => images.id, { onDelete: "set null" }),
  teaId: integer("tea_id").references(() => teas.id, { onDelete: "set null" }),
  userName: text("user_name").notNull().default(""),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("import_items_status_idx").on(t.status)]);

export type Tea = typeof teas.$inferSelect;
export type Printer = typeof printers.$inferSelect;
export type SheetFormatRow = typeof sheetFormats.$inferSelect;
export type TemplateRow = typeof templates.$inferSelect;
export type User = typeof users.$inferSelect;
export type ImportItem = typeof importItems.$inferSelect;
