// Misst Antwortzeiten der wichtigsten Seiten und PDF-Erzeugung gegen einen laufenden Server.
// Aufruf: node bench/run.mjs http://localhost:3123 admin geheim123
const [base = "http://localhost:3123", user = "admin", pass = "geheim123"] = process.argv.slice(2);

const login = await fetch(`${base}/login`, {
  method: "POST",
  redirect: "manual",
  headers: { "content-type": "application/x-www-form-urlencoded", origin: base },
  body: new URLSearchParams({ username: user, password: pass, redirectTo: "/" }),
});
const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
if (!cookie) throw new Error(`Login fehlgeschlagen (${login.status})`);

async function time(path, runs) {
  const ms = [];
  let bytes = 0;
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    const res = await fetch(base + path, { headers: { cookie, "accept-encoding": "identity" } });
    const buf = await res.arrayBuffer();
    ms.push(performance.now() - t);
    bytes = buf.byteLength;
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
  }
  ms.sort((a, b) => a - b);
  return { median: ms[Math.floor(ms.length / 2)], bytes };
}

const pages = ["/", "/?q=Spezial", "/tees/2", "/sammeldruck", "/drucker", "/drucker/1", "/verwaltung/protokoll", "/verwaltung/import", "/verwaltung/vorlagen/1", "/verwaltung/einstellungen"];
const pdfs = [
  ["1 Etikett", "/tees/2/etiketten.pdf?anzahl=1&vorschau=1&trotzdem=1"],
  ["12 Etiketten", "/tees/2/etiketten.pdf?anzahl=12&vorschau=1&trotzdem=1"],
  ["12 mit EAN+QR", "/tees/21/etiketten.pdf?anzahl=12&vorschau=1&trotzdem=1"],
  ["240 Etiketten", "/tees/2/etiketten.pdf?anzahl=240&vorschau=1&trotzdem=1"],
  ["Sammeldruck 24 Sorten", `/sammeldruck.pdf?vorschau=1&trotzdem=1&items=${Array.from({ length: 24 }, (_, i) => `${i + 2}:1`).join(",")}`],
  ["Testbogen", "/drucker/1/testbogen.pdf"],
];

await time("/", 3); // aufwärmen
await time(pdfs[1][1], 2);
console.log("| Seite | Median ms | KB |\n|---|---:|---:|");
for (const p of pages) {
  const r = await time(p, 15);
  console.log(`| ${p} | ${r.median.toFixed(1)} | ${(r.bytes / 1024).toFixed(1)} |`);
}
console.log("\n| PDF | Median ms | KB |\n|---|---:|---:|");
for (const [name, p] of pdfs) {
  const r = await time(p, name.startsWith("240") ? 3 : 5);
  console.log(`| ${name} | ${r.median.toFixed(0)} | ${(r.bytes / 1024).toFixed(0)} |`);
}
const t = performance.now();
await Promise.all(Array.from({ length: 5 }, () => fetch(base + pdfs[1][1], { headers: { cookie } }).then((r) => r.arrayBuffer())));
console.log(`\n5 gleichzeitige 12er-Bögen: ${(performance.now() - t).toFixed(0)} ms`);
