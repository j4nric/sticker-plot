/** Dateiname aus einem Teenamen, z. B. „Grüner Löwe“ → „gruener-loewe“. */
export function fileSlug(name: string): string {
  const map: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };
  return (
    name
      .toLowerCase()
      .replace(/[äöüß]/g, (c) => map[c] ?? c)
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tee"
  );
}
