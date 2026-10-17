# sticker-plot

Web-App für das Ladenpersonal eines Teeladens: Teesorten pflegen, Etiketten in einer Live-Vorschau
prüfen und druckfertige PDFs für Etikettenbögen erzeugen. Standard ist A4 quer mit 6 × 2 Etiketten
à 45,5 × 95,3 mm, weitere Bogenformate lassen sich anlegen. Pro Drucker wird eine Korrektur
gespeichert, die über einen Testbogen ermittelt wird. Alte Photoshop-Etiketten werden per
Texterkennung übernommen.

- Bedienung fürs Personal: [docs/bedienung.md](docs/bedienung.md)
- Installation und Betrieb auf dem Server: [docs/betrieb.md](docs/betrieb.md)
- Entscheidungen und Umsetzungsstand: [docs/entscheidungen-und-umsetzung.md](docs/entscheidungen-und-umsetzung.md)
- Technologiewahl: [docs/technologie-recherche.md](docs/technologie-recherche.md)

## Funktionen

| Bereich | Inhalt |
|---|---|
| Tees | Anlegen, bearbeiten, duplizieren, archivieren und wiederherstellen, endgültig löschen (nur Admin), Suche |
| Etikett | Name, Teeart, Beschreibung mit Absätzen, Zutaten mit fett, unterstrichen oder kursiv hervorgehobenen Allergenen (Knöpfe F/U/K), frei gestaltbare Fußzeile, Zubereitung (Menge, °C, Ziehzeit), Bio-Kennzeichnung, Preis, EAN-Strichcode, QR-Code, eigenes Bild oder Motiv (Tasse, Kanne, Kräuter, Früchte) |
| Vorschau | Etikett und Bogen in echter Größe, Platzanzeige, Warnung bei Überlauf und nicht druckbaren Zeichen |
| Drucken | Drucker, Bogenformat, Anzahl, erstes freies Feld (pro Drucker gemerkt), Füllmenge/MHD/Los, PDF-Vorschau im Dialog, Sammeldruck mehrerer Sorten auf einem Bogen |
| Kalibrierung | Testbogen mit Fadenkreuzen und Randmarken, vier Ablesewerte ergeben Versatz und Skalierung |
| Gestaltung | Vorlagen mit drei Varianten (klassisch, Band, minimal), Schriften, Schriftgrößen, Motivhöhe und sichtbaren Elementen, Live-Vorschau |
| Import | Alte PDF-Etiketten per Texterkennung (Web-Oberfläche und Kommandozeile), CSV-Import und -Export |
| Verwaltung | Benutzer mit Rollen, Änderungsprotokoll, Einstellungen, Bogenformate, Sicherung und Wiederherstellung |

## Technik

| Bereich | Wahl |
|---|---|
| Web-Framework | React Router 8 (Framework-Modus, SSR, Middleware), React 19, TypeScript |
| Styling | Tailwind CSS 4 für die App, eigenes CSS in mm/pt für das Etikett |
| PDF | HTML/CSS/SVG, gerendert von headless Chromium über `playwright-core`, Nachbearbeitung mit `pdf-lib` |
| Datenbank | SQLite mit `better-sqlite3` und Drizzle ORM, Migrationen in `drizzle/`, Bilder in der Datenbank |
| Texterkennung | `pdfjs-dist` + `@napi-rs/canvas` zum Rastern, `tesseract.js` mit deutschem Modell (offline) |
| Silbentrennung | `hyphen` (deutsche Trennmuster), identisch in Vorschau und PDF |
| Codes | `bwip-js` für EAN-13/EAN-8 und QR |
| Schriften | Oswald, Source Serif 4, Playfair Display (SIL Open Font License) in `public/fonts` |
| Tests | Vitest: Logik, Datenbank, echte PDF-Erzeugung |

### Aufbau

```
app/
  label/            Etikett: Geometrie, Kalibrierung, Design (CSS + React), Motive, Vorlagen, Texte, Codes, Testbogen
  lib/              Server: PDF-Renderer, Druckdienst, Anmeldung, Prüfung, Sicherung, CSV
  lib/import/       PDF-Texterkennung, Auswertung, Warteschlange, CSV-Import
  db/, models/      Datenbankschema und Zugriff
  components/       Editor, Vorschau, Druckfeld, Startfeld-Auswahl, PDF-Dialog
  routes/           Seiten und PDF-Endpunkte, routes/admin/ für die Verwaltung
scripts/            Installation, Sicherung, PDF-Import (Kommandozeile)
drizzle/            SQL-Migrationen (werden beim Start automatisch angewendet)
public/fonts/       Schriftdateien, gemeinsam für Browser und PDF
```

## Entwicklung

Voraussetzung: Node.js 22.22 oder neuer und ein Chromium für Playwright.

```bash
npm install
npx playwright-core install chromium   # einmalig
npm run dev                             # http://localhost:5173, Anmeldung: admin / tee
```

| Befehl | Zweck |
|---|---|
| `npm test` | Unit-, Datenbank- und PDF-Tests |
| `npm run typecheck` | Typen inkl. generierter Routentypen |
| `npm run build` | Produktions-Build nach `build/` (App und Import-Werkzeug) |
| `npm start` | Produktionsserver (braucht `APP_PASSWORD` und `SESSION_SECRET`) |
| `npm run import:pdfs -- <ordner> [--direkt]` | Alte PDF-Etiketten importieren (nach `npm run build`) |
| `npm run db:generate` | neue Migration nach Änderung an `app/db/schema.ts` |
| `npm run backup` | Sicherung der SQLite-Datei nach `data/backups/` |

## Konfiguration

Umgebungsvariablen, siehe [.env.example](.env.example). Alles Weitere wird in der App unter
Verwaltung eingestellt.

| Variable | Bedeutung |
|---|---|
| `APP_PASSWORD` | Passwort des ersten Benutzers „admin“, Pflicht in Produktion |
| `SESSION_SECRET` | langer Zufallswert für das Login-Cookie, Pflicht in Produktion |
| `DATABASE_PATH` | Pfad zur SQLite-Datei, Standard `./data/sticker-plot.db` |
| `SHOP_NAME`, `SHOP_URL` | Startwerte für die Fußzeile |
| `CHROMIUM_PATH` | optional, eigener Chromium-Pfad |
| `COOKIE_SECURE` | `false` nur, wenn die App ausnahmsweise ohne HTTPS läuft |
