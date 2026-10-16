/** „2027-10-16“ → „16.10.2027“; andere Eingaben bleiben unverändert. */
export function germanDate(s: string | undefined | null): string {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : (s ?? "").trim();
}
