# sticker-plot

Web-App für das Ladenpersonal: Tees mit Name, Teeart, Beschreibung, Zutaten und Tassenfarbe anlegen,
Etiketten in einer Live-Vorschau prüfen und druckfertige PDFs für den Etikettenbogen erzeugen
(A4 quer, 6 × 2 Etiketten à 45,5 × 95,3 mm). Pro Drucker wird eine Korrektur gespeichert, die über
einen Testbogen ermittelt wird.

## Funktionen (MVP)

- **Teeverwaltung** mit Suche, Anlegen, Bearbeiten, Löschen. Daten liegen in SQLite.
- **Live-Vorschau** von Etikett und Bogen. Sie nutzt dieselben Schriften, dasselbe CSS und dieselbe
  Textanpassung wie das PDF. Zu lange Texte werden automatisch verkleinert; passt es auch in
  kleinster Schrift nicht, erscheint eine Warnung.
- **PDF-Druck** mit Drucker, Anzahl und erstem freien Feld. Angebrochene Bögen lassen sich so
  aufbrauchen; größere Mengen laufen über mehrere Bögen. Jeder Druck wird protokolliert.
- **Druckerkalibrierung**: Testbogen mit zwei Fadenkreuzen und Millimeterskala sowie Randmarken.
  Das Personal trägt vier Ablesewerte ein, die App berechnet Verschiebung und Skalierung.
- **Login** mit gemeinsamem Laden-Passwort.

Bedienungsanleitung fürs Personal: [docs/bedienung.md](docs/bedienung.md).
Installation auf dem vServer: [docs/betrieb.md](docs/betrieb.md).
Hintergrund und Technologiewahl: [docs/technologie-recherche.md](docs/technologie-recherche.md).

## Technik

| Bereich | Wahl |
|---|---|
| Web-Framework | React Router 8 (Framework-Modus, SSR), React 19, TypeScript |
| Styling | Tailwind CSS 4 für die App, eigenes CSS in mm/pt für das Etikett |
| PDF | HTML/CSS/SVG, gerendert von headless Chromium über `playwright-core` |
| Datenbank | SQLite mit `better-sqlite3` und Drizzle ORM, Migrationen in `drizzle/` |
| Schriften | Oswald und Source Serif 4 (SIL Open Font License) in `public/fonts` |
| Tests | Vitest (Logik, Datenbank, echte PDF-Erzeugung) |

Die Recherche hatte React Router 7 empfohlen. Inzwischen ist Version 8 aktuell; sie ist der direkte
Nachfolger mit denselben Konzepten, Middleware ist jetzt Standard.

### Aufbau

```
app/
  label/            Etikett: Geometrie, Kalibrierung, Design (CSS + React), Testbogen, Textanpassung
  lib/              Server: PDF-Renderer, HTML-Dokument, Login-Session, Eingabeprüfung
  db/, models/      Datenbankschema und Zugriff
  components/       Editor, Vorschau, Druckfeld
  routes/           Seiten und PDF-Endpunkte
drizzle/            SQL-Migrationen (werden beim Start automatisch angewendet)
public/fonts/       Schriftdateien, gemeinsam für Browser und PDF
poc/                ursprünglicher Machbarkeitstest aus der Recherche
```

Das Etikett ist eine React-Komponente (`app/label/Label.tsx`) mit CSS in Millimetern
(`app/label/label.css`). Für das PDF wird der Bogen serverseitig zu HTML gerendert, Schriften werden
eingebettet, Chromium passt die Texte an und druckt eine A4-Querseite pro Bogen. Die Vorschau im
Browser verwendet exakt dieselben Bausteine.

## Entwicklung

Voraussetzung: Node.js 22.22 oder neuer und ein Chromium für Playwright.

```bash
npm install
npx playwright-core install chromium   # einmalig, lädt das passende Chromium
cp .env.example .env                    # optional, in der Entwicklung gibt es Standardwerte
npm run dev                             # http://localhost:5173, Passwort in der Entwicklung: tee
```

Wichtige Befehle:

```bash
npm test              # Unit-, Datenbank- und PDF-Tests
npm run typecheck     # Typen inkl. generierter Routentypen
npm run build         # Produktions-Build nach build/
npm start             # Produktionsserver (braucht APP_PASSWORD und SESSION_SECRET)
npm run db:generate   # neue Migration nach Änderung an app/db/schema.ts
npm run backup        # Sicherung der SQLite-Datei nach data/backups/
```

Ist bereits ein Chromium installiert, das nicht zur Playwright-Version passt, findet die App es im
Playwright-Browserverzeichnis automatisch. Alternativ `CHROMIUM_PATH` setzen.

## Konfiguration

Alle Einstellungen über Umgebungsvariablen, siehe [.env.example](.env.example).

| Variable | Bedeutung |
|---|---|
| `APP_PASSWORD` | gemeinsames Passwort fürs Personal, Pflicht in Produktion |
| `SESSION_SECRET` | langer Zufallswert zum Signieren des Login-Cookies, Pflicht in Produktion |
| `DATABASE_PATH` | Pfad zur SQLite-Datei, Standard `./data/sticker-plot.db` |
| `SHOP_NAME`, `SHOP_URL` | Fußzeile auf jedem Etikett |
| `CHROMIUM_PATH` | optional, eigener Chromium-Pfad |
| `COOKIE_SECURE` | `false` nur, wenn die App ausnahmsweise ohne HTTPS läuft |

## Bekannte Grenzen und nächste Schritte

- Die Bogengeometrie stammt aus dem bisherigen Photoshop-PDF. Beim ersten Testdruck prüfen, ob die
  Fadenkreuze grob auf den Ecken liegen; kleine Abweichungen gleicht die Kalibrierung aus. Größere
  Abweichungen im Raster werden in `app/label/geometry.ts` korrigiert.
- Die äußeren Etiketten beginnen 0,5 mm vom Papierrand. Bürodrucker drucken meist erst ab 3 bis
  5 mm, dann fehlt dort ein Stück des Rahmens. Die Randmarken auf dem Testbogen zeigen den
  tatsächlichen Rand. Falls das stört, wäre ein Design ohne seitliche Rahmenlinie die Lösung.
- Felder für Pflichtangaben nach Lebensmittelrecht (Füllmenge, MHD, Los) sind noch nicht vorgesehen.
- Geplant laut Recherche: mehrere Vorlagen, grafischer Editor für Etikettelemente,
  Shopify-Anbindung.
