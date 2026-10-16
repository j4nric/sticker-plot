import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
};

/** Teesorten mit allen Texten, die auf das Etikett kommen. */
export const teas = sqliteTable("teas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  teaType: text("tea_type").notNull().default(""),
  description: text("description").notNull().default(""),
  ingredients: text("ingredients").notNull().default(""),
  color: text("color").notNull().default("#4f9a3f"),
  ...timestamps,
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
  ...timestamps,
});

/** Protokoll der erzeugten Etiketten-PDFs. */
export const printJobs = sqliteTable("print_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teaId: integer("tea_id").references(() => teas.id, { onDelete: "set null" }),
  teaName: text("tea_name").notNull(),
  printerId: integer("printer_id").references(() => printers.id, { onDelete: "set null" }),
  labelCount: integer("label_count").notNull(),
  startPosition: integer("start_position").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Tea = typeof teas.$inferSelect;
export type Printer = typeof printers.$inferSelect;
