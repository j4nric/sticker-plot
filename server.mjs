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
app.use(createRequestHandler({ build, mode: process.env.NODE_ENV }));

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => console.log(`Tee-Etiketten läuft auf http://localhost:${port}`));

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
