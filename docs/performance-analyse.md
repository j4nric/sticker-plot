# Performance-Analyse und Refactoring (Oktober 2026)

Ziel war eine gründliche Analyse der App mit messbaren Verbesserungen und
aufgeräumtem Code. Grundlage waren eigene Messungen und ein unabhängiges
Code-Audit; jeder Befund aus dem Audit wurde geprüft, bevor er umgesetzt wurde.

## Messaufbau

- Testdaten: 200 Sorten, 5 000 Druckaufträge, 20 000 Protokolleinträge (`bench/seed.mjs`)
- Messung: `bench/run.mjs` gegen den laufenden Produktionsserver; Median aus 15 (Seiten) bzw.
  3–5 (PDFs) Abrufen
- Vorher und Nachher liefen gleichzeitig auf derselben Maschine im Wechsel (alter Stand = `main`
  vor dieser Änderung, eigener Worktree, eigener Port)
- Tipp-Latenz: Playwright tippt 66 Zeichen in die Beschreibung (Etikett- und Bogenansicht) und
  misst über die Event-Timing-API alle Eingabe-Ereignisse über 16 ms

Selbst nachmessen:

```bash
node bench/seed.mjs <pfad-zur-test.db>        # Testdaten in eine Kopie der Datenbank
node bench/run.mjs http://localhost:3000 admin <passwort>
```

## Ergebnisse

### PDF-Erzeugung

| Auftrag | vorher | nachher | PDF vorher | PDF nachher |
|---|---:|---:|---:|---:|
| 1 Etikett | 165 ms | 135 ms | 62 KB | 39 KB |
| 12 Etiketten | 262 ms | 191 ms | 492 KB | 217 KB |
| 12 Etiketten mit EAN und QR | 304 ms | 195 ms | 465 KB | 191 KB |
| 240 Etiketten (20 Bögen) | 2 814 ms | 1 378 ms | 9,4 MB | 3,9 MB |
| Sammeldruck, 24 Sorten | 427 ms | 377 ms | 928 KB | 345 KB |
| 5 Bögen gleichzeitig | 647 ms | 472 ms | | |
| 240 Etiketten mit 2,7-MB-Bild | **Fehler 500 nach 19 s** | 6,8 s | – | 2,9 MB |

### Browser

| | vorher | nachher |
|---|---:|---:|
| größter JS-Chunk (Editor, Vorlagen, Einstellungen) | 1 206 KB (358 KB gzip) | 316 KB (116 KB gzip) |
| JS-Chunk Bogenformat-Editor | 92 KB | entfällt |
| Etikett-CSS | in jeder HTML-Antwort | eigene Datei, ein Jahr im Cache |
| Tipp-Latenz im Editor, Mittel der Ereignisse > 16 ms | 64 ms | 25 ms |
| Tipp-Latenz im Editor, langsamstes Ereignis | 144 ms | 80 ms |

### Seiten (Server)

Die Seiten waren schon vorher schnell (5–22 ms) und bleiben es. Die HTML-Antworten sind 8–10 KB
kleiner, weil das Etikett-CSS nicht mehr eingebettet wird. Alle wichtigen Abfragen laufen jetzt
über Indizes (mit `EXPLAIN QUERY PLAN` geprüft):

| Abfrage | vorher | nachher |
|---|---|---|
| Teeliste: letzter Druck je Sorte | voller Scan aller Druckaufträge | Covering Index `print_jobs(tea_id, created_at)` |
| Sorte nach Name (Import, Duplikate) | voller Scan mit `lower(name)` | Ausdrucksindex `lower(name)` |
| Protokoll, neueste zuerst | Sortierung aller Einträge | Index `audit_log(created_at)` |
| Importwarteschlange | voller Scan | Index `import_items(status)` |

## Was die Zeit gekostet hat und was geändert wurde

### 1. Punktring des Tassenmotivs (größter Einzelfaktor)

Die Analyse des PDF-Inhalts zeigte rund 1 240 Bézierkurven je Etikett, davon 1 166 in einem
einzigen Pfad. Der gepunktete Ring um die Tasse war mit `stroke-dasharray` gezeichnet; Chromium
zerlegt so eine Strichelung beim PDF-Export in viele kleine Kurvenstücke. Jetzt ist der Ring ein
vorberechneter Pfad aus 96 kurzen Strichen mit runden Enden und sieht unverändert aus. Das PDF
ist dadurch 60 % kleiner, und der Schritt `page.pdf` bei 240 Etiketten sank von 1,7 s auf 0,9 s.

### 2. Jede Sorte nur einmal rendern

Vorher wurde jedes Etikett einzeln als HTML erzeugt und im Browser einzeln vermessen, bei 240
gleichen Etiketten also 240-mal. Jetzt steht jede Sorte genau einmal im Dokument. Nach dem
Anpassen der Schriftgröße kopiert ein kleines Skript sie in alle Felder (`expandLabelRefs`).
- Das HTML für 240 Etiketten schrumpft von 1,1 MB auf 0,36 MB.
- Die Schrift wird je Sorte nur einmal vermessen.
- Ein eigenes Bild steht nur noch einmal als data:-URL im Dokument. Vorher stand es in jedem
  Feld: Bei einem großen Bild und 240 Etiketten überschritt das die maximale Zeichenkettenlänge
  von JavaScript, und das PDF scheiterte mit Fehler 500.

### 3. Schriftgröße per binärer Suche

`fitLabelText` verkleinerte bisher in 0,2-pt-Schritten und erzwang dabei jedes Mal ein neues
Layout, bis zu 30-mal je Feld. Jetzt sucht es binär im selben 0,2-pt-Raster: höchstens etwa
6 Layouts, mit gleichem Ergebnis.

### 4. Kleinere Dinge in der PDF-Pipeline

- Ein gemeinsamer Browser-Kontext für alle Anfragen statt eines neuen je PDF.
- Eingebettet werden nur noch die Schriften, die die Vorlagen des Auftrags nutzen. Jede
  eingebettete Schrift kostet beim Laden messbar Zeit: alle Schriften zusammen etwa 50 ms.
  Ausprobiert und verworfen: Schriften per Request-Interception ausliefern. Playwright umgeht
  dabei den Browser-Cache, deshalb war das nicht schneller.

### 5. Client-Bundle

- **bwip-js** (die komplette Barcode-Bibliothek mit über 100 Symbologien, 257 KB gzip) ist durch
  einen eigenen EAN-13/EAN-8-Encoder (60 Zeilen) und `uqr` für QR-Codes ersetzt. Die Strichmuster
  wurden für acht Nummern gegen bwip-js abgeglichen, die QR-Matrizen für URLs ebenso. Die
  Muster sind als Test festgehalten.
- **zod** landete über eine Hilfsfunktion im Bogenformat-Editor; `parseDecimal` und die Feldliste
  liegen jetzt in abhängigkeitsfreien Modulen.
- **Silbentrennung** (deutsche Muster, 105 KB gzip) bleibt bewusst im Bundle. Ohne sie würde die
  serverseitig gerenderte Vorschau beim Hydrieren nicht mehr übereinstimmen. Sie wird nur auf
  den Seiten mit Etikettvorschau geladen und bleibt im Browser-Cache.

### 6. Editor-Vorschau

- Pro Tastendruck liefen zwei vollständige Fit-Durchläufe, weil `document.fonts.ready` auch nach
  dem Laden noch einmal auslöste. Außerdem renderte jede Messung das ganze Formular neu. Jetzt
  läuft der zweite Durchlauf nur, solange Schriften noch laden, und gemeldet wird nur eine
  Änderung.
- Die Vorschau ist eine eigene memoisierte Komponente (`LabelPreviewPanel`) mit
  `useDeferredValue`: Das Eingabefeld reagiert sofort, die Vorschau folgt.
- Die Silbentrennung speichert Wörter zwischen. Beim Tippen ändert sich meist nur das letzte
  Wort, und im Bogen steht dasselbe Etikett bis zu 12-mal.

## Fehler, die bei der Analyse gefunden und behoben wurden

| Befund | Auswirkung | Behebung |
|---|---|---|
| Bild in jedem Feld des PDF-HTML | 240 Etiketten mit großem Bild: Fehler 500 | siehe Punkt 2 |
| Duplizierte Sorte teilt das Bild; Bild ersetzen löschte es auch beim Original | Original verliert still sein Bild | Bilder werden nur gelöscht, wenn keine Sorte und kein Import sie mehr nutzt; verwaiste Bilder werden aufgeräumt |
| Passwortwechsel und Wiederherstellung ließen bestehende Anmeldungen gültig | Altes Passwort bzw. andere Datenbank: Sitzung bleibt aktiv | Cookie enthält einen Fingerabdruck des Passwort-Hashes |
| Login-Sperre nutzte die erste, frei fälschbare `X-Forwarded-For`-Adresse | Sperre umgehbar, Tabelle ließ sich leeren | echte Client-IP aus Express, zusätzliche Sperre je Name (20 Versuche), Aufräumen statt Leeren |
| Fußnotensterne „Grüner Tee\*, Hibiskus\*“ wurden fett | falscher Druck | Markdown-Regel: Zeichen öffnen nur vor Text und schließen nur nach Text |
| PDF-Abruf zählte bei jedem Laden | Neu laden oder Herunterladen schrieb das Startfeld doppelt fort | Kennung je Klick, Wiederholungen liefern das fertige PDF ohne neue Buchung |
| Startfeld im Formular lokal geraten | nach Fehler oder Druckerwechsel falsches Feld | wird nach dem Druck vom Server neu geladen |
| Formular erlaubte mehr Etiketten als der Server | leere Fehlerseite | gemeinsame Höchstzahl 600 |
| CSV-Export ohne Formelschutz | `=…` in Namen wird in Excel ausgeführt | Apostroph davor, beim Import wieder entfernt |
| Upload-Größe erst nach dem Einlesen geprüft | große Anfragen landen im Speicher | Grenzen je Route in `server.mjs`, vor dem Einlesen |
| SVG-Bereinigung ließ `href=javascript:` ohne Anführungszeichen durch | nur Verteidigung in der Tiefe (Bilder laufen in einer Sandbox) | Prüfung auch ohne Anführungszeichen |
| IDs aus der URL uneinheitlich geprüft | POST an `/verwaltung/vorlagen/abc` legte eine neue Vorlage an | gemeinsame Prüfung `parseId` (404) |

## Refactoring

- `lib/locale.ts`: Zahlen- und Datumsformat an einer Stelle. Vorher gab es rund zehn eigene
  Formatierer in einzelnen Dateien.
- `lib/params.ts` (`parseId`) und `readPrintQuery` für beide PDF-Routen. Die Routen schrumpften
  von 32 bzw. 30 auf 19 bzw. 17 Zeilen.
- Neue Komponenten: `Notice` (elf kopierte Hinweisboxen), `LabelPreviewPanel` (aus dem
  334-Zeilen-Editor) und `import/PdfUploader` sowie `import/ReviewItem` (Import-Seite von 369 auf
  193 Zeilen). Die Geräteauswahl liegt jetzt im eigenen Hook `useDeviceChoice`.
- Entfernt wurden veraltete oder ungenutzte Exporte: `SHEET`, `LABELS_PER_SHEET`, `LabelData`,
  `parseEmphasis`, `stripMarkup`, `requireAdminUser`, `htmlToPng`, `printExtrasInput` und das
  doppelte `isHexColor`.
- Einheitliche Konstanten: `DEFAULT_TEA_COLOR`, `validColor`, `MAX_PRINT_LABELS`,
  `GEOMETRY_FIELDS` (in `geometry.ts`).
- `tsconfig`: `noUnusedLocals` ist eingeschaltet, ungenutzte Importe fallen jetzt beim Typecheck
  auf.

## Bewusst nicht geändert

- **Teeliste ohne Seitenaufteilung:** 200 Sorten sind 165 KB HTML und komprimiert etwa 12 KB,
  der Server braucht 13 ms. Das lohnt sich erst bei deutlich mehr Sorten.
- **pdf-lib-Nachbearbeitung** (Titel und „keine Skalierung“): 10–30 ms, bei 240 Etiketten etwa
  200 ms. Eine eigene inkrementelle PDF-Änderung wäre schneller, aber fehleranfälliger.
- **Vergabe der Druckaufträge per GET:** Die Kennung je Klick verhindert Doppelbuchungen. Ein
  Umbau auf POST hätte den Ablauf „PDF öffnet im neuen Tab“ verändert.

## Hinweise für den Betrieb

- Nach dem Update ist **einmal neu anmelden** nötig, weil das Sitzungs-Cookie jetzt einen
  Passwort-Fingerabdruck enthält.
- Wer einen Namen 20-mal falsch eingibt, sperrt ihn für 10 Minuten, auch über verschiedene
  Geräte hinweg. Ein Administrator kann in dieser Zeit nicht helfen; die Sperre läuft von
  selbst ab.
