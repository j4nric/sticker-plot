import { describe, expect, it } from "vitest";
import { chooseTitle, cleanLine, fold, joinLines, matchTeaType, nameFromFileName, similarity, snapColor, splitDescription } from "./interpret";

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

  it("ordnet Teearten der bekannten Liste zu", () => {
    expect(matchTeaType("GRUNER TEE")).toEqual({ teaType: "Grüner Tee", confidence: expect.any(Number) });
    expect(matchTeaType("FRUCHTETEE").teaType).toBe("Früchtetee");
    expect(matchTeaType("HONEYBUSH").teaType).toBe("Honeybush");
    expect(matchTeaType("").teaType).toBe("");
  });

  it("fügt Zeilen zu Fließtext zusammen und löst Trennstriche", () => {
    expect(joinLines("Ein Grüntee mit mittel-\ngrünem Blatt\nund Note.\n\nZweiter Absatz.")).toBe("Ein Grüntee mit mittelgrünem Blatt und Note.\n\nZweiter Absatz.");
    expect(joinLines("Vanille-\nKaramell")).toBe("Vanille- Karamell");
  });

  it("trennt eine Zutatenliste aus der Beschreibung ab", () => {
    expect(splitDescription("Fruchtig und mild.\nZutaten: Apfel, Hibiskus")).toEqual({ description: "Fruchtig und mild.", ingredients: "Apfel, Hibiskus" });
  });

  it("rastet erkannte Farben auf Standardfarben ein", () => {
    expect(snapColor("#62a05b")).toBe("#4f9a3f");
    expect(snapColor("#123456")).toBe("#123456");
  });
});
