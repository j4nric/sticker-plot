# Proof of Concept: HTML-Bogen → PDF über Chromium

Minimaler Praxistest der in `docs/technologie-recherche.md` empfohlenen Pipeline.

- `template.html` – Etikettenbogen A4 quer, 6 × 2 Etiketten. Rastergeometrie, Druckerkalibrierung
  und Sortenfarbe sind CSS-Variablen; die Texte kommen als URL-Parameter (später: Formular/Datenbank).
- `render.mjs` – öffnet das Template in headless Chromium (Playwright) und schreibt ein PDF.

```bash
cd poc
npm install
node render.mjs out/sheet.pdf
node render.mjs out/rooibos.pdf "title=Rooibos%20Vanille&type=Rooibos&color=%23c0392b&cal-x=2mm&cal-y=-1.5mm"
```

Ohne `CHROMIUM_PATH` sucht das Skript ein installiertes Chromium unter den üblichen Pfaden;
alternativ `npx playwright install chromium` ausführen und `executablePath` weglassen.

Nachmessen (optional, benötigt poppler-utils):

```bash
pdfinfo out/sheet.pdf          # Page size: 841.92 x 594.96 pts = 297 x 210 mm
pdftoppm -png -r 300 out/sheet.pdf out/sheet
```
