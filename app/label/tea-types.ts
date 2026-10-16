/** Vorschläge für Teearten mit passender Standardfarbe der Tasse. */
export const TEA_TYPES: { name: string; color: string }[] = [
  { name: "Grüner Tee", color: "#4f9a3f" },
  { name: "Schwarzer Tee", color: "#8a4b2a" },
  { name: "Oolong", color: "#b07a2a" },
  { name: "Weißer Tee", color: "#b3a06a" },
  { name: "Matcha", color: "#5d9a2c" },
  { name: "Rooibos", color: "#c0522b" },
  { name: "Kräutertee", color: "#6c8f3a" },
  { name: "Früchtetee", color: "#c2185b" },
  { name: "Chai", color: "#a0582d" },
  { name: "Mate", color: "#7c8a2e" },
];

export const DEFAULT_TEA_COLOR = "#4f9a3f";

export function colorForTeaType(type: string): string | undefined {
  const t = type.trim().toLowerCase();
  return TEA_TYPES.find((x) => x.name.toLowerCase() === t)?.color;
}

export function isHexColor(v: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(v);
}
