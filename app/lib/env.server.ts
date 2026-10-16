const isProduction = process.env.NODE_ENV === "production";

function setting(name: string, devFallback: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (isProduction) {
    throw new Error(`Umgebungsvariable ${name} muss in Produktion gesetzt sein (siehe .env.example).`);
  }
  return devFallback;
}

export const env = {
  isProduction,
  get appPassword() {
    return setting("APP_PASSWORD", "tee");
  },
  get sessionSecret() {
    return setting("SESSION_SECRET", "dev-secret-nicht-fuer-produktion");
  },
  databasePath: process.env.DATABASE_PATH?.trim() || "./data/sticker-plot.db",
  shop: {
    name: process.env.SHOP_NAME?.trim() || "Tee-Treff-Punkt",
    url: process.env.SHOP_URL?.trim() || "www.teetreffpunkt.de",
  },
  chromiumPath: process.env.CHROMIUM_PATH?.trim() || undefined,
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE !== "false" : isProduction,
};
