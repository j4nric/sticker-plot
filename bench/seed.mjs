// Füllt eine Test-Datenbank mit realistischen Mengen: 200 Sorten, 5000 Druckaufträge, 20000 Protokolleinträge.
import Database from "better-sqlite3";

const db = new Database(process.argv[2]);
const types = ["Grüner Tee", "Schwarzer Tee", "Früchtetee", "Kräutertee", "Rooibos", "Oolong", "Weißer Tee"];
const desc =
  "Ein aromatischer Tee mit feinem, vollmundigem Geschmack und einer leicht blumigen Note. Ideal für ruhige Nachmittage und gemütliche Abende mit Freunden.";
const ingr = "Grüner Tee (China), Apfelstücke, *Mandel*stücke, ++Soja++lecithin, Aroma, Ringelblumenblüten";
const now = Math.floor(Date.now() / 1000);
db.transaction(() => {
  const tea = db.prepare(
    "INSERT INTO teas (name, tea_type, description, ingredients, color, brew_amount, brew_temp, brew_time, organic, ean, product_url, price, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
  );
  for (let i = 1; i <= 200; i++) {
    tea.run(`Testsorte ${i} Spezial`, types[i % types.length], desc, ingr, "#4f9a3f", "1 TL", 80, "3 Min.", i % 3 === 0 ? 1 : 0,
      i % 4 === 0 ? "4006381333931" : "", i % 5 === 0 ? `https://example.com/tee/${i}` : "", i % 2 ? "6,90 €" : "", now, now);
  }
  const job = db.prepare("INSERT INTO print_jobs (tea_id, tea_name, printer_id, label_count, start_position, user_name, created_at) VALUES (?,?,?,?,?,?,?)");
  for (let i = 0; i < 5000; i++) job.run((i % 200) + 1, "x", 1, 12, 1, "admin", now - i * 600);
  const log = db.prepare("INSERT INTO audit_log (user_name, action, entity, entity_id, summary, created_at) VALUES (?,?,?,?,?,?)");
  for (let i = 0; i < 20000; i++) log.run("admin", "ändern", "tee", (i % 200) + 1, "Testeintrag", now - i * 60);
})();
console.log("seeded", db.prepare("select count(*) n from teas").get());
