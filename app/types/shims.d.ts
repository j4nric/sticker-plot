// Typen für Pakete ohne (für TypeScript auffindbare) Deklarationen

declare module "bwip-js" {
  export function toSVG(options: Record<string, unknown>): string;
}

declare module "hyphen/de" {
  const hyphen: { hyphenateSync(text: string, options?: { minWordLength?: number; hyphenChar?: string; debug?: boolean }): string };
  export default hyphen;
}
