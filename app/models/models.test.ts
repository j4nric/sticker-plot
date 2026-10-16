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
    recordPrintJob({ teaId: tea.id, teaName: tea.name, printerId: resolvePrinter().id, labelCount: 12, startPosition: 1 });

    expect(listTeas().map((t) => t.name)).toEqual(["Assam", "China Sencha"]);
    expect(listTeas("grün").map((t) => t.name)).toEqual(["China Sencha"]);
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
