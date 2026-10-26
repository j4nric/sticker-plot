import { describe, expect, it } from "vitest";
import { chooseTitle, cleanLine, fold, joinLines, matchTeaKind, nameFromFileName, similarity, splitDescription, splitTypeFromBlock } from "./interpret";

describe("Import-Auswertung", () => {
  it("leitet Namen aus Dateinamen ab", () => {
    expect(nameFromFileName("CHINA_SENCHA_new.pdf")).toBe("China Sencha");
    expect(nameFromFileName("rooibos_vanille-karamell_final_v2.pdf")).toBe("Rooibos Vanille-Karamell");
    expect(nameFromFileName("scan0001.pdf")).toBe("");
    expect(nameFromFileName("Etiketten 2024 Assam TGFOP.pdf")).toBe("Assam TGFOP");
  });

  it("vergleicht unempfindlich gegen Umlaute und Groß-/Kleinschreibung", () => {
    expect(fold("GRÜNER TEE")).toBe(fold("Gruener Tee"));
    expect(similarity("CHINA SFNCHA", "China Sencha")).toBeGreaterThan(0.9);
    expect(similarity("Assam", "Darjeeling")).toBeLessThan(0.4);
  });

  it("entfernt Störzeichen von Rahmen und Ornamenten", () => {
    expect(cleanLine("& CHINA SENCHA @")).toBe("CHINA SENCHA");
    expect(cleanLine("—Y feinherben, leicht")).toBe("feinherben, leicht");
  });

  it("wählt den Titel per Mehrheit aus OCR-Läufen und Dateiname", () => {
    const r = chooseTitle(
      [
        { text: "CHINA SFNCHA", confidence: 52 },
        { text: "CHINA SENCHA", confidence: 51 },
        { text: "CHINA SENCHA", confidence: 60 },
      ],
      "",
    );
    expect(r.name).toBe("China Sencha");
    expect(r.confidence).toBeGreaterThan(90);
    expect(chooseTitle([{ text: "xx", confidence: 10 }], "Mate").name).toBe("Mate");
    expect(chooseTitle([], "").warning).toBeDefined();
  });

  it("ordnet Teearten den fünf Arten zu, auch zweizeilig und mit Lesefehlern", () => {
    expect(matchTeaKind("GRUNER TEE")).toMatchObject({ kind: "gruen", flavored: false, teaType: "Grüntee" });
    expect(matchTeaKind("AROMATISIERTER\nSCHWARZER TEE")).toMatchObject({ kind: "schwarz", flavored: true, teaType: "Aromatisierter Schwarztee" });
    expect(matchTeaKind("AROMATISIERTER FRUCHTETEE")).toMatchObject({ kind: "fruechte", flavored: true });
    expect(matchTeaKind("AR0MATISIERTER R00IBOS")).toMatchObject({ kind: "rooibos", flavored: true });
    expect(matchTeaKind("KRAUTER TEE")).toMatchObject({ kind: "kraeuter" });
    expect(matchTeaKind("HONEYBUSH").kind).toBe("");
    expect(matchTeaKind("").teaType).toBe("");
  });

  it("trennt Teeart in Großbuchstaben von der Beschreibung", () => {
    expect(splitTypeFromBlock("AROMATISIERTER\nGRÜNER TEE\n———\nEin feiner Grüntee mit\nKirsche.")).toEqual({ type: "AROMATISIERTER\nGRÜNER TEE", rest: "Ein feiner Grüntee mit\nKirsche." });
    expect(splitTypeFromBlock("GRÜNER TEE\n\nEin Grüntee.")).toEqual({ type: "GRÜNER TEE", rest: "Ein Grüntee." });
    expect(splitTypeFromBlock("Ein Grüntee ohne Teeart.")).toEqual({ type: "", rest: "Ein Grüntee ohne Teeart." });
    // Reste des Zierrahmens darüber werden übersprungen
    expect(splitTypeFromBlock("7 NE SC o0wI wi\nGRUNER TEE\nEin Grüntee mit Blatt.")).toEqual({ type: "GRUNER TEE", rest: "Ein Grüntee mit Blatt." });
  });

  it("fügt Zeilen zu Fließtext zusammen und löst Trennstriche", () => {
    expect(joinLines("Ein Grüntee mit mittel-\ngrünem Blatt\nund Note.\n\nZweiter Absatz.")).toBe("Ein Grüntee mit mittelgrünem Blatt und Note.\n\nZweiter Absatz.");
    expect(joinLines("Vanille-\nKaramell")).toBe("Vanille- Karamell");
  });

  it("trennt eine Zutatenliste aus der Beschreibung ab", () => {
    expect(splitDescription("Fruchtig und mild.\nZutaten: Apfel, Hibiskus")).toEqual({ description: "Fruchtig und mild.", ingredients: "Apfel, Hibiskus" });
  });
});
