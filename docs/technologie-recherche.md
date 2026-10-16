# Technologie-Recherche: Generator für Tee-Etikettenbögen (A4, PDF)

Stand: 16.10.2026

## 1. Ausgangslage und Anforderungen

**Heute:** Etiketten werden als Photoshop-Action erstellt und als PDF exportiert. Das Beispiel-PDF
(`CHINA_SENCHA_new.pdf`) ist ein **einziges 300-dpi-Rasterbild** (3508 × 2480 px, JPEG, 4,5 MB) auf
einer A4-Querseite, ohne eingebettete Schriften oder Text. Jede Textänderung braucht also Photoshop.

**Ziel:** Weboberfläche für das Ladenpersonal. Eingabe von Titel, Teeart, Beschreibung, Zutaten und
Farbe der Teetasse, Ausgabe als druckfertiges A4-PDF für den Büro-Drucker. Ausbaustufen:
Datenbank für Sorten, später Anpassung der Etikettelemente per GUI. Hosting auf eigenem vServer,
eigene Lösung statt Fertigtool, Sprache frei wählbar.

**Aus dem Original-PDF gemessene Bogengeometrie** (Grenzen der gedruckten Briefmarken-Grafik, am
physischen Bogen gegen die Stanzung prüfen):

| Parameter | Wert |
|---|---|
| Bogen | 297 × 210 mm (A4 quer) |
| Etikett (Hochformat) | ca. 45,5 × 95,3 mm |
| Raster | 6 Spalten × 2 Zeilen = 12 Etiketten |
| Erstes Etikett, linke obere Ecke | x = 0,5 mm, y = 6,3 mm |
| Abstand Spalte zu Spalte | 50,0 mm |
| Abstand Zeile zu Zeile | 103,1 mm |

**Bewertungskriterien**

1. Millimetergenaues Layout auf dem Bogenraster, verlässlich reproduzierbar.
2. Einfache Eingabemaske, die Ladenpersonal ohne Anleitung bedienen kann.
3. Live-Vorschau, die exakt dem späteren PDF entspricht.
4. Ausbaufähig: Sortendatenbank, mehrere Vorlagen, GUI-Editor für Positionen und Schriften.
5. Druckerkalibrierung (Versatz pro Drucker) als Teil des Workflows.
6. Betrieb auf einem vServer ohne Spezialsoftware, wartbar von einer Person.
7. Freie Gestaltung: eigene Schriften, Vektorgrafiken, sortenabhängige Farben.

## 2. Kandidaten im Überblick

| Ansatz | Layout-Präzision | Vorschau = PDF | GUI-Editor später | Gestaltungsfreiheit | Betrieb | Fazit |
|---|---|---|---|---|---|---|
| **A. HTML/CSS/SVG → headless Chromium (Playwright)** | sehr hoch | ja, identische Engine | gut, eigenes Template-JSON | sehr hoch | Chromium im Docker-Container | **Empfehlung** |
| **B. pdfme** (TypeScript, eigener Designer) | hoch | ja, eigener Viewer | sofort vorhanden | mittel | reines Node, leichtgewichtig | starke Alternative, wenn Designer ab Tag 1 wichtiger ist als Gestaltungsfreiheit |
| **C. Typst** (+ Paket etykett) | sehr hoch | nur über Neu-Kompilieren | schwach, Code-Vorlagen | hoch | Typst-Binary oder WASM | gut für Entwickler, nicht für GUI-Ausbau |
| **D. WeasyPrint** (Python, HTML/CSS) | hoch | nein, eigene Engine | wie A, aber zweite Render-Engine | hoch, aber CSS-Teilmenge | Python-Paket | gute Wahl nur, wenn Python-Stack gesetzt ist |
| **E. Low-Level-PDF-Bibliotheken** (pdf-lib, PDFKit, ReportLab, @react-pdf/renderer) | sehr hoch | nein | mühsam | Textsatz von Hand | leichtgewichtig | nur als Baustein (z. B. Ausschießen) |
| **F. Canvas-Editoren** (Konva, Fabric.js, labellife, qrlayout-ui) | Pixelbasis | ja, aber Canvas | sofort vorhanden | hoch | Browser | als Editor-Baustein denkbar, nicht als Druckpfad |

### A. HTML/CSS/SVG, gerendert mit headless Chromium (Playwright)

Das Etikett wird als HTML-Template mit CSS in Millimetern beschrieben. Chromium rendert dieselbe
Seite einmal im Browser als Vorschau und einmal auf dem Server als PDF. `@page { size: 297mm 210mm;
margin: 0 }` legt das Blatt fest, Playwright übernimmt die Größe mit `preferCSSPageSize`
([Playwright-Doku, page.pdf](https://github.com/microsoft/playwright/blob/main/docs/src/api/class-page.md)).

Stärken

- Vorschau und Druck sind dieselbe Engine, damit entfällt die klassische Abweichung „sieht am
  Bildschirm anders aus als im PDF“.
- Volle CSS- und SVG-Mächtigkeit: Webfonts, Flexbox, `hyphens: auto` für deutsche Silbentrennung,
  Inline-SVG mit `currentColor` für die sortenabhängige Tassenfarbe, Masken, Verläufe.
- Druckerkalibrierung ist eine CSS-Transformation auf dem Bogencontainer
  (`translate(--cal-x, --cal-y) scale(--cal-scale)`), gespeichert pro Drucker.
- Ein späterer GUI-Editor arbeitet auf demselben DOM: Elemente absolut in mm positionieren, per
  Drag-and-drop verschieben, Werte in ein Template-JSON schreiben. Der Renderer bleibt unverändert.
- Ausgabe ist ein echtes Vektor-PDF mit eingebetteten, untergesetzten Schriften.

Schwächen

- Chromium auf dem Server: ca. 300 MB Image-Größe und 200 bis 400 MB RAM pro Renderlauf. Für einen
  vServer unproblematisch, aber ein Prozess, den man überwachen muss.
- Chromium-PDFs sind RGB; CMYK oder PDF/X wären nur mit Nachbearbeitung möglich. Für den
  Bürodrucker irrelevant.

### B. pdfme

Open-Source-Bibliothek (MIT, TypeScript) mit JSON-Templates, Generator für Node und Browser sowie
einem fertigen React-Designer. Aktuelle Version 6.2.6 vom 16.10.2026, laufende Pflege
([Releases](https://github.com/pdfme/pdfme/releases)). Unterstützte Elemente: Text und
Multivariable-Text, Linie, Rechteck, Ellipse, Bild, SVG, Tabelle, Liste, Barcodes und Formularfelder.
Text bietet dynamische Schriftgröße (Min, Max, Fit), Zeilenabstand, Ausrichtung, eigene TTF/OTF-Schriften
und einfaches Inline-Markdown ([Supported Features](https://github.com/pdfme/pdfme/blob/main/website/docs/supported-features.md)).

Stärken

- Der Drag-and-drop-Designer existiert ab Tag 1 und speichert das Template als JSON. Genau das ist
  der gewünschte Ausbau „Elemente per GUI anpassen“.
- Kein Browser auf dem Server nötig, der Generator läuft mit pdf-lib im Node-Prozess oder sogar
  direkt im Browser.
- Gleicher Technologieraum (TypeScript, React) wie Ansatz A, eine Kombination ist möglich.

Schwächen

- Eigener Layout-Motor statt CSS: keine Silbentrennung, kein Flexbox, keine Masken oder Filter.
  Dekorative Rahmen und die Tasse müssen als fertige SVG- oder Bilddateien vorliegen; eine
  sortenabhängige Einfärbung des SVG ist nicht dokumentiert und müsste über ein eigenes
  Schema-Plugin oder vorgefärbte Varianten gelöst werden.
- Ein Template ist eine Seite. Für 6 × 2 Etiketten entweder 12-fach duplizierte Elemente im Template
  oder ein Etikett rendern und mit pdf-lib ausschießen (siehe Abschnitt 4, Ausschießen).
- Der Designer ist generisch, für Ladenpersonal zu mächtig. Er bliebe ein Admin-Werkzeug, die
  Eingabemaske muss trotzdem selbst gebaut werden.

### C. Typst (mit Paket etykett)

Modernes Satzsystem mit sehr präzisem Layout und schnellem Compiler. Das Universe-Paket
[etykett](https://forum.typst.app/t/etykett-0-1-0-a-small-template-for-printing-on-label-sheets/2971)
konfiguriert Etikettenbögen über Seitenmaße, Zeilen, Spalten, Ränder und Zwischenräume und kann
bereits verbrauchte Etiketten überspringen. Kompilierung in Node oder Browser über
[typst.ts](https://github.com/myriad-dreamin/typst.ts) oder typst-wasm.

Stärken: exakte Maße, kleine PDFs, Vorlagen sind lesbarer Code, Druck-PDF ohne Browser.
Schwächen: Vorschau nur durch Neu-Kompilieren (schnell, aber nicht dieselbe Engine wie die
Web-Oberfläche), Templates sind Code, ein GUI-Editor für Positionen müsste Typst-Quelltext
erzeugen. Eigene Schriften und SVG funktionieren, Einfärben von SVG ist eingeschränkt. Gute Wahl,
wenn ausschließlich Entwickler Vorlagen pflegen. Das widerspricht dem GUI-Ausblick.

### D. WeasyPrint (Python)

HTML/CSS-zu-PDF-Engine ohne Browser, aktiv gepflegt (v69.0 Juni 2026, v70.0 Oktober 2026 mit
Sicherheitsfix, [Release-Übersicht](https://opencollective.com/courtbouillon/updates)). Sehr gute
Unterstützung für CSS Paged Media, aber kein JavaScript und nur eine CSS-Teilmenge (kein Grid in
voller Breite, keine CSS-Filter oder Masken, Flexbox mit Lücken).

Stärken: leichtgewichtig, exakte Maße, Python-Ökosystem (FastAPI, SQLAlchemy).
Schwächen: Die Vorschau im Browser und das PDF kommen aus zwei verschiedenen Engines, Abweichungen
bei Schriftmetrik und Umbruch sind die Regel und müssen bei jeder Designänderung geprüft werden.
Wer HTML/CSS als Template-Sprache will, fährt mit Chromium (A) sicherer.

### E. Low-Level-PDF-Bibliotheken

pdf-lib und PDFKit (Node), ReportLab (Python) zeichnen PDF-Primitiven direkt. Zeilenumbruch,
Silbentrennung und Textfluss sind Handarbeit. @react-pdf/renderer bietet ein Flexbox-Modell in React,
hat aber Versionsregressionen bei Zeilenhöhe und eigene Font-Regeln
([Vergleich 2026](https://www.pkgpulse.com/guides/react-pdf-vs-react-pdf-renderer-vs-jspdf-pdf-in-react-2026)).
Für dieses Projekt lohnen sie sich als Baustein, vor allem pdf-lib zum Ausschießen und Zusammenfügen,
nicht als Haupt-Renderer.

### F. Canvas-basierte Editoren

Konva und Fabric.js sind MIT-lizenzierte Canvas-Bibliotheken, auf denen Editoren wie
[labellife-design-tool](https://cdn.jsdelivr.net/npm/labellife-design-tool@2.3.3/README.md) oder
[qrlayout-ui](https://cdn.jsdelivr.net/npm/qrlayout-ui@1.1.5/README.md) aufsetzen. Sie liefern
schnell ein Drag-and-drop-Gefühl, exportieren aber Pixel oder einen Canvas-Zustand. Für Druck in
Vektorqualität braucht es dann doch einen serverseitigen Renderer. Als Editor-Oberfläche in Phase 3
denkbar, nicht als Druckpfad.

### Ausgeschlossen

- Weiter mit Photoshop oder ein Wechsel auf InDesign Data Merge, Avery Design & Print, Canva Bulk
  Create: vom Auftraggeber ausgeschlossen, zudem kein Web-Workflow für das Personal.
- Nur „Drucken aus dem Browser“ ohne serverseitiges PDF: Browser-Druckdialoge setzen eigene Ränder
  und Skalierung, das Ergebnis hängt vom Rechner des Mitarbeiters ab.

## 3. Empfehlung

**Ansatz A: Web-App in TypeScript, Etikett als HTML/CSS/SVG-Template, PDF über headless Chromium
(Playwright), Daten in SQLite, Betrieb als Docker-Container auf dem vServer.**

Begründung in Kürze

- Erfüllt alle sieben Kriterien, insbesondere die exakte Übereinstimmung von Vorschau und Druck.
- Höchste Gestaltungsfreiheit für das geplante Redesign (Schriften, Vektorrahmen, Farbe pro Sorte).
- Der GUI-Editor in Phase 3 ist eine Erweiterung desselben Templates, kein zweiter Renderpfad.
- Eine Sprache (TypeScript) für Oberfläche, Server, Template und spätere Shopify-Anbindung.
- pdfme bleibt als Reserve: dessen React-Designer ließe sich für Admin-Zwecke integrieren, falls ein
  eigener Editor zu aufwendig wird.

### Vorgeschlagener Stack

| Schicht | Wahl | Alternative |
|---|---|---|
| Web-Framework | React Router v7 (Framework-Modus, ehemals Remix) mit TypeScript | SvelteKit, falls React im Team weniger vertraut ist |
| Oberfläche | Formulare mit Server-Actions, Tailwind CSS | |
| Etikett-Renderer | HTML/CSS/SVG-Template, Werte aus JSON | |
| PDF | Playwright (`playwright-core`) + Chromium im Container | |
| Datenbank | SQLite über Drizzle ORM, eine Datei, einfaches Backup | PostgreSQL erst bei Mehrstandortbetrieb |
| Auth | einfacher Login mit Passwort oder Basic Auth hinter Reverse Proxy | |
| Betrieb | Docker Compose auf dem vServer, Caddy oder nginx als TLS-Proxy | |

Shopify-Apps basieren auf React Router, deshalb die Präferenz für React: Eine spätere Übernahme der
Sortendaten aus Shopify (Metafelder für Beschreibung, Zutaten, Farbe) nutzt denselben Stack.

## 4. Architektur und Kernkonzepte

### Datenmodell

```
Sorte        id, name, teeart, beschreibung, zutaten, farbe, vorlage_id, aktiv
Vorlage      id, name, bogen_id, elemente (JSON: Typ, x/y/Breite/Höhe in mm, Schrift, Farbe, Bindung an Feld)
Bogen        id, name, breite, höhe, spalten, zeilen, ursprung_x, ursprung_y, abstand_x, abstand_y, etikett_breite, etikett_höhe
Drucker      id, name, versatz_x, versatz_y, skalierung
Druckauftrag id, sorte_id, drucker_id, anzahl_bögen, erstellt_am, pdf_pfad
```

Phase 1 kommt mit fest codiertem Template und einem Bogen aus; die Tabellen sind trotzdem von
Anfang an so geschnitten, damit Phase 2 und 3 keine Migration der Grundidee brauchen.

### Renderpfad

1. Formular oder Sortenauswahl liefert die Felder.
2. Server rendert das Template als HTML (Vorschau im Browser, identisch mit Druck).
3. Playwright öffnet dieselbe URL im Chromium und erzeugt das PDF mit `preferCSSPageSize`.
4. PDF wird gespeichert und zum Download angeboten.

Alternative zum 12-fach-Rendern: ein Etikett als PDF-Seite rendern und mit pdf-lib
(`embedPage`) zwölfmal auf A4 quer platzieren. Dieses „Ausschießen“ trennt Etikettgestaltung von
Bogengeometrie sauber, ist aber im PoC nicht nötig gewesen, weil CSS-Raster und Kalibrierung direkt
im Template funktionieren.

### Druckerkalibrierung

Erkenntnisse aus Hersteller-Hilfen: Ein gleichmäßiger Versatz deutet auf Druckerränder oder
Treiber-Offset, ein von Etikett zu Etikett wachsender Versatz auf Skalierung
([Onlinelabels Alignment Guide](https://www.onlinelabels.com/articles/printer-alignment-guide),
[SimplyPrint](https://help.simplyprint.io/en/article/filament-label-generation-fixing-label-printing-alignment-issues-1gyockj/)).
Daraus der Workflow:

1. Testbogen drucken: Fadenkreuze an den vier Ecken des Rasters, Millimeterskala am Rand, Hinweis
   „Tatsächliche Größe / 100 %“ im Druckdialog.
2. Mitarbeiter misst die Abweichung des Fadenkreuzes oben links in mm (x, y) und optional die
   Skalenlänge, trägt die Werte in die Web-Maske ein.
3. Werte werden pro Drucker gespeichert und als `--cal-x`, `--cal-y`, `--cal-scale` in das Template
   gegeben. Alle weiteren Drucke auf diesem Drucker sitzen.

Der PoC zeigt, dass der Versatz exakt umgesetzt wird (Abschnitt 5).

### Farbe pro Sorte

Die Tasse wird als Inline-SVG mit `fill: currentColor` eingebettet, die Farbe kommt aus der Sorte
als CSS-Variable. Dekorative Rahmen können als SVG mit `currentColor` oder fester Farbe dienen.
Wird das heutige Rasterbild der Tasse behalten, wäre ein Umfärben nur über CSS-Masken (`mask-image`)
möglich; eine saubere Vektorzeichnung ist die bessere Grundlage für das Redesign.

### Schriften

Das Original nutzt eine Condensed-Grotesk für den Titel und eine Serifenschrift für den Fließtext.
Da das Design ohnehin neu entsteht: Open-Source-Schriften unter SIL Open Font License wählen
(z. B. Oswald oder Bebas Neue für den Titel, Source Serif oder EB Garamond für Text) und als
WOFF2 mit ausliefern. Damit ist die Lizenzfrage für Server-Rendering geklärt.

### GUI-Editor (Phase 3)

Das Template-JSON beschreibt jedes Element mit Position und Größe in mm, Schriftart, Größe,
Farbe und Datenbindung. Der Editor zeigt ein Etikett in Originalgröße (CSS mm), Elemente lassen sich
mit einer kleinen Drag-Bibliothek (z. B. interact.js oder Moveable) verschieben und skalieren,
Eigenschaften werden in einer Seitenleiste bearbeitet. Gespeichert wird nur das JSON; der Renderer
ist derselbe wie für den Druck. Fallback: pdfme-Designer einbinden und dessen JSON in das eigene
Template übersetzen.

## 5. Praxistest (Proof of Concept)

Im Ordner `poc/` liegt eine lauffähige Minimalversion des empfohlenen Renderpfads:
`template.html` (Bogen mit 6 × 2 Etiketten, Geometrie, Kalibrierung und Farbe als CSS-Variablen)
und `render.mjs` (Playwright, Chromium, PDF-Export).

Ergebnisse, nachgemessen durch Rasterung des erzeugten PDFs mit 300 dpi:

| Prüfung | Ergebnis |
|---|---|
| Seitengröße | 841,92 × 594,96 pt = 297,0 × 209,9 mm |
| Linke Etikettkanten | 0,51 / 50,55 / 100,58 / 150,54 / 200,58 / 250,61 mm (Soll 0,5 + n × 50) |
| Obere Etikettkanten | 6,35 / 109,30 mm (Soll 6,3 / 109,4) |
| Kalibrierung x = +2 mm, y = −1,5 mm | linke Kante 2,54 mm, obere Kante 4,83 mm (Soll 2,5 / 4,8) |
| Dateigröße | 77 KB Vektor-PDF mit eingebetteten Schriften (Original: 4,5 MB Rasterbild) |
| Farbe pro Sorte | per URL-Parameter gewechselt (Grün → Rot), ohne Änderung am Template |

Alle Abweichungen liegen unter 0,15 mm und innerhalb der Rasterungsgenauigkeit. Die
Rendering-Dauer lag bei etwa einer Sekunde pro Bogen inklusive Browserstart.

## 6. Risiken und offene Punkte

- **Bogengeometrie** ist aus der Druckgrafik gemessen, nicht aus einem Stanzplan. Vor dem ersten
  Echtdruck mit Lineal am leeren Bogen verifizieren und in der Bogen-Tabelle hinterlegen.
- **Druckdialog:** Mitarbeiter müssen „Tatsächliche Größe“ wählen. Das PDF sollte eine kurze
  Druckanweisung als Deckblatt oder die Web-Maske einen Hinweis enthalten.
- **Lebensmittelkennzeichnung:** Das heutige Etikett enthält weder Füllmenge, Mindesthaltbarkeit,
  Los noch Anschrift. Für vorverpackten Tee verlangt die LMIV diese Angaben; bei loser Abfüllung im
  Laden gelten andere Regeln. Das sollte geklärt werden, bevor das Datenmodell final ist, denn
  Chargenfelder (MHD, Los) wären Eingaben pro Druck, nicht pro Sorte.
- **Chromium-Betrieb:** Speicher und Zombie-Prozesse überwachen, Browser-Instanz pro Request
  sauber schließen oder einen Pool nutzen. Offizielles Playwright-Docker-Image verwenden.
- **Sicherheit:** Die App gehört hinter TLS und Login; Chromium darf nur lokale Template-URLs laden.
- **Backup:** SQLite-Datei und erzeugte PDFs regelmäßig sichern (einfacher Cron auf dem vServer).

## 7. Vorschlag für die Umsetzung in Phasen

1. **MVP (Woche 1 bis 2):** Formular mit den fünf Feldern, festes Template im neuen Design,
   PDF-Download, Kalibrierungsseite mit Testbogen und Druckerprofil, Login.
2. **Sortenverwaltung:** Sorten anlegen, bearbeiten, suchen; Druck aus der Sortenliste;
   Druckhistorie.
3. **Vorlagen und Editor:** Template-JSON, mehrere Vorlagen, Drag-and-drop-Editor für Admins.
4. **Shopify-Anbindung:** Sorten und Metafelder aus dem Shop synchronisieren, Etikett direkt aus dem
   Produkt drucken.

## Quellen

- pdfme: [Releases](https://github.com/pdfme/pdfme/releases), [Supported Features](https://github.com/pdfme/pdfme/blob/main/website/docs/supported-features.md), [GitHub](https://www.github.com/pdfme/pdfme), [pdfme.com](https://pdfme.com/)
- Playwright: [class Page, page.pdf](https://github.com/microsoft/playwright/blob/main/docs/src/api/class-page.md)
- Chromium-PDF und CSS Paged Media: [CSS for Print & PDF Generation](https://slicker.me/css/print-pdf.html), [Optimize HTML for PDF Printing](https://htmlcsstoimage.com/blog/optimize-html-for-pdf-printing), [PDF margins in Playwright](https://macmyths.com/how-to-control-pdf-margins-in-playwright-javascript-and-python/)
- WeasyPrint: [CourtBouillon Updates](https://opencollective.com/courtbouillon/updates), [v70.0](https://newreleases.io/project/pypi/weasyprint/release/70.0), [Debian Tracker](https://tracker.debian.org/pkg/weasyprint)
- Typst: [etykett](https://typst.app/universe/package/etykett), [Forum: etykett 0.1.0](https://forum.typst.app/t/etykett-0-1-0-a-small-template-for-printing-on-label-sheets/2971), [Templates for Avery Zweckform labels](https://forum.typst.app/t/templates-for-avery-zweckform-labels/9335), [typst.ts](https://github.com/myriad-dreamin/typst.ts), [typst-wasm](https://forum.typst.app/t/typst-wasm-compile-typst-in-browsers-node-and-serverless-runtimes/9399)
- react-pdf: [react-pdf vs react-pdf/renderer vs jsPDF 2026](https://www.pkgpulse.com/guides/react-pdf-vs-react-pdf-renderer-vs-jspdf-pdf-in-react-2026)
- Druckerkalibrierung: [Onlinelabels Printer Alignment Guide](https://www.onlinelabels.com/articles/printer-alignment-guide), [SimplyPrint: Label alignment](https://help.simplyprint.io/en/article/filament-label-generation-fixing-label-printing-alignment-issues-1gyockj/), [Brady: Printing Adjustments](https://support.bradyid.com/articles/en_US/Knowledge/Printing-Adjustments-Best-Practices-Troubleshooting), [WPS: Avery alignment on A4](https://www.wps.com/office-quick-solution/document-file-issues/how-to-fix-avery-label-printing-alignment-on-a4-paper/)
- Canvas-Editoren: [labellife-design-tool](https://cdn.jsdelivr.net/npm/labellife-design-tool@2.3.3/README.md), [qrlayout-ui](https://cdn.jsdelivr.net/npm/qrlayout-ui@1.1.5/README.md), [Konva Badge Maker](https://konvajs.org/docs/sandbox/Badge_Maker.html), [Label design tool with React and Konva](https://www.bitcot.com/building-custom-label-design-tool-with-react-and-konva-js/)
