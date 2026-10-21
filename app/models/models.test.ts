import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.DATABASE_PATH = ":memory:";
});

describe("Datenbank", () => {
  it("legt beim Start einen Standarddrucker an", async () => {
    const { listPrinters } = await import("./printer.server");
    const printers = listPrinters();
    expect(printers).toHaveLength(1);
    expect(printers[0]!.isDefault).toBe(true);
  });

  it("speichert Tees, protokolliert Drucke und findet per Suche", async () => {
    const { createTea, listTeas, recordPrintJob, lastPrintJobs, deleteTea } = await import("./tea.server");
    const { resolvePrinter } = await import("./printer.server");
    const tea = createTea({ name: "China Sencha", teaType: "Grüner Tee", description: "x", ingredients: "", color: "#4f9a3f" });
    createTea({ name: "Assam", teaType: "Schwarzer Tee", description: "", ingredients: "", color: "#8a4b2a" });
    recordPrintJob({ teaId: tea.id, teaName: tea.name, printerId: resolvePrinter().id, labelCount: 12, startPosition: 1, userName: "test" });

    expect(listTeas().map((t) => t.name)).toEqual(["Assam", "China Sencha"]);
    expect(listTeas({ query: "grün" }).map((t) => t.name)).toEqual(["China Sencha"]);
    expect(listTeas().find((t) => t.id === tea.id)!.lastPrintedAt).toBeInstanceOf(Date);
    expect(lastPrintJobs(tea.id)).toHaveLength(1);

    deleteTea(tea.id);
    expect(listTeas().map((t) => t.name)).toEqual(["Assam"]);
  });

  it("verwaltet Standarddrucker und verhindert das Löschen des letzten", async () => {
    const { createPrinter, deletePrinter, listPrinters, setDefaultPrinter, resolvePrinter } = await import("./printer.server");
    const first = listPrinters()[0]!;
    const second = createPrinter("Büro");
    setDefaultPrinter(second.id);
    expect(resolvePrinter().id).toBe(second.id);
    expect(resolvePrinter(first.id).id).toBe(first.id);
    expect(deletePrinter(second.id)).toBe(true);
    expect(resolvePrinter().id).toBe(first.id);
    expect(listPrinters()[0]!.isDefault).toBe(true);
    expect(deletePrinter(first.id)).toBe(false);
  });
});

describe("Startdaten und neue Funktionen", () => {
  it("legt Admin, Bogenformat, Vorlage und Einstellungen an", async () => {
    const { authenticate, listUsers } = await import("./user.server");
    const { listFormats } = await import("./format.server");
    const { listTemplates } = await import("./template.server");
    const { getSettings } = await import("./settings.server");
    expect(listUsers().map((u) => [u.username, u.role])).toEqual([["admin", "admin"]]);
    expect(authenticate("admin", "tee")?.username).toBe("admin");
    expect(authenticate("admin", "falsch")).toBeNull();
    expect(listFormats()[0]!.columns).toBe(6);
    expect(listTemplates()[0]!.params.variant).toBe("klassisch");
    expect(getSettings().overflowPolicy).toBe("block");
    expect(getSettings().shop).toMatchObject({ separator: "blatt", footerItalic: true });
  });

  it("archiviert, dupliziert und löscht Tees", async () => {
    const { createTea, archiveTea, duplicateTea, listTeas, countArchived } = await import("./tea.server");
    const t = createTea({ name: "Earl Grey", teaType: "Schwarzer Tee", color: "#8a4b2a", brewTemp: 95 });
    const copy = duplicateTea(t.id)!;
    expect(copy.name).toBe("Earl Grey (Kopie)");
    expect(copy.brewTemp).toBe(95);
    expect(duplicateTea(t.id)!.name).toBe("Earl Grey (Kopie 2)");
    archiveTea(t.id, true);
    expect(listTeas().some((x) => x.id === t.id)).toBe(false);
    expect(listTeas({ archived: true }).map((x) => x.id)).toContain(t.id);
    expect(countArchived()).toBe(1);
  });

  it("behält ein geteiltes Bild, bis keine Sorte es mehr nutzt", async () => {
    const { createTea, duplicateTea, setTeaImage, deleteTea } = await import("./tea.server");
    const { saveImage, getImage, deleteUnusedImages } = await import("./image.server");
    const t = createTea({ name: "Bildtee" });
    const img = saveImage("image/png", Buffer.from("x"));
    setTeaImage(t.id, img);
    const copy = duplicateTea(t.id)!;
    expect(copy.imageId).toBe(img);
    setTeaImage(copy.id, null);
    deleteUnusedImages();
    expect(getImage(img)).toBeDefined();
    deleteTea(t.id);
    expect(getImage(img)).toBeUndefined();
  });

  it("speichert eine angepasste Fußzeile", async () => {
    const { getSettings, saveSettings } = await import("./settings.server");
    const s = getSettings();
    saveSettings({ ...s, shop: { ...s.shop, name: "*Teeladen*", url: "", address: "Hauptstraße 5", separator: "punkt", footerItalic: false } });
    expect(getSettings().shop).toMatchObject({ name: "*Teeladen*", url: "", address: "Hauptstraße 5", separator: "punkt", footerItalic: false });
  });

  it("schreibt das Startfeld eines Druckers fort", async () => {
    const { resolvePrinter, setNextSlot } = await import("./printer.server");
    setNextSlot(resolvePrinter().id, 7);
    expect(resolvePrinter().nextSlot).toBe(7);
  });

  it("importiert Tees aus CSV", async () => {
    const { importTeasFromCsv } = await import("~/lib/import/csv-import.server");
    const { findTeaByName } = await import("./tea.server");
    const csv = "\uFEFFname;teeart;beschreibung;temperatur;bio;ean\r\nAssam;Schwarzer Tee;Kräftig;95 °C;ja;\r\nDarjeeling;Schwarzer Tee;\"Blumig; fein\";;;400638133393\r\n;leer\r\nKaputt;;;300;;\r\n";
    const report = importTeasFromCsv(csv, "upsert");
    expect(report.created).toBe(1);
    expect(report.updated).toBe(1);
    expect(report.errors).toHaveLength(1);
    expect(findTeaByName("Darjeeling")?.description).toBe("Blumig; fein");
    expect(findTeaByName("Darjeeling")?.ean).toBe("4006381333931");
    expect(findTeaByName("Assam")?.organic).toBe(true);
  });
});
