import { data } from "react-router";

/** Numerische ID aus einem URL-Parameter; alles andere ergibt 404. */
export function parseId(value: string | undefined): number {
  const n = Number(value);
  if (!value || !/^\d{1,15}$/.test(value) || n < 1) throw data("Nicht gefunden", { status: 404 });
  return n;
}
