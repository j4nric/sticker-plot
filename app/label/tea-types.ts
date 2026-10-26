/**
 * Die fünf Teearten des Ladens. Jede kann aromatisiert sein; Farbe und
 * Motiv kommen zentral aus den Einstellungen (Standardwerte hier).
 */
export const TEA_KINDS = {
  fruechte: { name: "Früchtetee", color: "#c2185b" },
  kraeuter: { name: "Kräutertee", color: "#6c8f3a" },
  schwarz: { name: "Schwarztee", color: "#8a4b2a" },
  gruen: { name: "Grüntee", color: "#4f9a3f" },
  rooibos: { name: "Rooibostee", color: "#c0522b" },
} as const satisfies Record<string, { name: string; color: string }>;

export type TeaKind = keyof typeof TEA_KINDS;
export const TEA_KIND_KEYS = Object.keys(TEA_KINDS) as TeaKind[];

export const DEFAULT_TEA_COLOR = TEA_KINDS.gruen.color;

export const isTeaKind = (v: unknown): v is TeaKind => typeof v === "string" && v in TEA_KINDS;

/** Text auf dem Etikett, z. B. „Aromatisierter Schwarztee“. */
export function teaTypeLabel(kind: TeaKind, flavored: boolean): string {
  return `${flavored ? "Aromatisierter " : ""}${TEA_KINDS[kind].name}`;
}

const KIND_PATTERNS: [TeaKind, RegExp][] = [
  ["fruechte", /fr[uü]e?cht|frucht/],
  ["kraeuter", /kr[aä]e?uter/],
  ["rooibos", /rooibos|rotbusch/],
  ["schwarz", /schwarz/],
  ["gruen", /gr[uü]e?n|sencha|matcha/],
];

/**
 * Erkennt Art und Aromatisierung in freiem Text („Aromatisierter grüner Tee“,
 * „Rooibos“, „Früchte-Tee“). Für alte Datensätze, CSV und den PDF-Import.
 */
export function guessTeaKind(text: string): { kind: TeaKind; flavored: boolean } | null {
  const t = text.toLowerCase();
  const hit = KIND_PATTERNS.find(([, re]) => re.test(t));
  return hit ? { kind: hit[0], flavored: /aromati/.test(t) } : null;
}
