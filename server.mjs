/**
 * Produktionsserver. Ersetzt react-router-serve, weil die App hinter einem
 * Webserver (Caddy, nginx) läuft: Nur mit „trust proxy“ übernimmt Express
 * Protokoll und Adresse aus X-Forwarded-*, sonst hält React Router die über
 * HTTPS abgeschickten Formulare für Anfragen von fremden Seiten und lehnt sie ab.
 */
import { createRequestHandler } from "@react-router/express";
import compression from "compression";
import express from "express";
import morgan from "morgan";

const build = await import("./build/server/index.js");
const app = express();

app.disable("x-powered-by");
// Nur Proxys aus dem eigenen Rechner bzw. internen (Docker-)Netzen vertrauen
app.set("trust proxy", "loopback, linklocal, uniquelocal");
app.use(compression());
app.use("/assets", express.static("build/client/assets", { immutable: true, maxAge: "1y" }));
app.use(express.static("build/client", { maxAge: "1h" }));
app.use(morgan("tiny"));
// Größe von Uploads prüfen, bevor die App den Inhalt in den Speicher liest.
// Die Routen prüfen ihre genauen Grenzen danach selbst noch einmal.
const MB = 1024 * 1024;
const BODY_LIMITS = [
  [/^\/tees\/\d+\/bild$/, 4 * MB],
  [/^\/verwaltung\/import\/status$/, 41 * MB],
  [/^\/verwaltung\/import$/, 11 * MB],
  [/^\/verwaltung\/sicherung$/, 520 * MB],
];
app.use((req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD") return next();
  const limit = BODY_LIMITS.find(([re]) => re.test(req.path))?.[1] ?? 2 * MB;
  const length = req.headers["content-length"];
  if (length === undefined && req.headers["transfer-encoding"]) return res.status(411).send("Length Required");
  if (Number(length) > limit) return res.status(413).send("Die Datei ist zu groß.");
  next();
});
// Client-Adresse für die Login-Sperre (app/lib/rate-limit.server.ts); ein
// mitgeschickter Header gleichen Namens wird überschrieben
app.use((req, _res, next) => {
  req.headers["x-tee-client-ip"] = req.ip ?? "";
  next();
});
app.use(createRequestHandler({ build, mode: process.env.NODE_ENV }));

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => console.log(`Tee-Etiketten läuft auf http://localhost:${port}`));

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
