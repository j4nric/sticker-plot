/** Sortierungen der Teeliste (Wert in der URL → Bezeichnung). */
export const TEA_SORTS = {
  name: "Name A–Z",
  "name-ab": "Name Z–A",
  neu: "Zuletzt hinzugefügt",
  alt: "Zuerst hinzugefügt",
  gedruckt: "Zuletzt gedruckt",
  art: "Teeart",
} as const;
export type TeaSort = keyof typeof TEA_SORTS;
export const isTeaSort = (v: unknown): v is TeaSort => typeof v === "string" && v in TEA_SORTS;
