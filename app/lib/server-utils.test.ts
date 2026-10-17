import { describe, expect, it } from "vitest";
import { parseCsv, toCsv, unescapeCsvText } from "./csv";
import { germanDate } from "./locale";
import { hashPassword, verifyPassword } from "./password.server";
import { CLIENT_IP_HEADER, lockedMinutes, loginKeys, registerFailure, registerSuccess } from "./rate-limit.server";
import { normalizeBrewAmount, normalizeBrewTime, parseMixedItems, readGeometry } from "./validation";

describe("CSV", () => {
  it("schreibt und liest Felder mit Trennzeichen, Anführungszeichen und Umbrüchen", () => {
    const csv = toCsv([
      ["name", "text"],
      ["A; B", 'Sagt "hallo"\nzweite Zeile'],
      ["C", true],
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(parseCsv(csv)).toEqual([
      ["name", "text"],
      ["A; B", 'Sagt "hallo"\nzweite Zeile'],
      ["C", "ja"],
    ]);
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
  it("entschärft Formeln und stellt den Text beim Einlesen wieder her", () => {
    const [, row] = parseCsv(toCsv([["name", "zahl"], ["=HYPERLINK(1)", -5]]));
    expect(row).toEqual(["'=HYPERLINK(1)", "-5"]);
    expect(unescapeCsvText(row![0]!)).toBe("=HYPERLINK(1)");
    expect(unescapeCsvText("'normal")).toBe("'normal");
  });
});

describe("Passwörter und Anmeldesperre", () => {
  it("hasht mit Salz und prüft korrekt", () => {
    const h = hashPassword("geheim123");
    expect(h).not.toBe(hashPassword("geheim123"));
    expect(verifyPassword("geheim123", h)).toBe(true);
    expect(verifyPassword("falsch", h)).toBe(false);
    expect(verifyPassword("x", "kaputt")).toBe(false);
  });
  it("sperrt nach fünf Fehlversuchen für zehn Minuten", () => {
    const keys = loginKeys(new Request("http://x", { headers: { [CLIENT_IP_HEADER]: "1.2.3.4", "x-forwarded-for": "9.9.9.9" } }), "Admin");
    expect(keys).toEqual(["c|1.2.3.4|admin", "u|admin"]);
    const t = 1_000_000;
    for (let i = 0; i < 4; i++) registerFailure(keys, t);
    expect(lockedMinutes(keys, t)).toBe(0);
    registerFailure(keys, t);
    expect(lockedMinutes(keys, t)).toBe(10);
    expect(lockedMinutes(keys, t + 11 * 60_000)).toBe(0);
    registerSuccess(keys);
    expect(lockedMinutes(keys, t)).toBe(0);
  });

  it("sperrt den Namen auch bei wechselnden Adressen", () => {
    const t = 2_000_000;
    for (let i = 0; i < 20; i++) registerFailure(loginKeys(new Request("http://x", { headers: { [CLIENT_IP_HEADER]: `10.0.0.${i}` } }), "chef"), t);
    const fresh = loginKeys(new Request("http://x", { headers: { [CLIENT_IP_HEADER]: "10.0.1.1" } }), "chef");
    expect(lockedMinutes(fresh, t)).toBe(10);
    registerSuccess(fresh);
  });
});

describe("Eingaben", () => {
  it("vereinheitlicht Zubereitungsangaben", () => {
    expect(normalizeBrewTime("3")).toBe("3 Min.");
    expect(normalizeBrewTime("2-3")).toBe("2–3 Min.");
    expect(normalizeBrewTime("2 - 3 Minuten")).toBe("2–3 Min.");
    expect(normalizeBrewTime("nach Geschmack")).toBe("nach Geschmack");
    expect(normalizeBrewAmount("3")).toBe("3 g");
    expect(normalizeBrewAmount("1 TL / 250 ml")).toBe("1 TL / 250 ml");
  });
  it("liest Sammeldruck-Auswahl", () => {
    expect(parseMixedItems("12:3,15:9")).toEqual([
      { teaId: 12, count: 3 },
      { teaId: 15, count: 9 },
    ]);
    expect(parseMixedItems("12:0")).toBeNull();
    expect(parseMixedItems("x")).toBeNull();
    expect(parseMixedItems("1:400,2:400")).toBeNull();
  });
  it("formatiert Datumswerte deutsch", () => {
    expect(germanDate("2027-10-16")).toBe("16.10.2027");
    expect(germanDate("Ende 2027")).toBe("Ende 2027");
  });
  it("prüft Bogenformate aus dem Formular", () => {
    const f = new FormData();
    f.set("name", "A4 hoch");
    for (const [k, v] of Object.entries({ pageWidth: "210", pageHeight: "297", columns: "2", rows: "4", labelWidth: "99,1", labelHeight: "67,7", originX: "4,6", originY: "13,1", pitchX: "101,6", pitchY: "67,7" }))
      f.set(k, v);
    expect(readGeometry(f).errors).toEqual([]);
    f.set("columns", "3");
    expect(readGeometry(f).errors.length).toBeGreaterThan(0);
  });
});

describe("SVG-Bereinigung", () => {
  it("entfernt Skripte, Ereignisse und fremde Verweise", async () => {
    const { sanitizeSvg } = await import("~/models/image.server");
    const svg =
      '<svg><script>alert(1)</script><a href=javascript:alert(1)><rect onclick="x()"/></a><use xlink:href="#a"/><image href="data:image/png;base64,AA"/><image href="https://x.y/z.png"/></svg>';
    const out = sanitizeSvg(svg);
    expect(out).not.toMatch(/script|javascript|onclick|https:/);
    expect(out).toContain('xlink:href="#a"');
    expect(out).toContain('href="data:image/png;base64,AA"');
  });
});
