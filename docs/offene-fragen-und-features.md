# Offene Fragen, Grenzfälle und Feature-Ideen

Stand: 16.10.2026, nach dem MVP. Die Grenzfälle in Abschnitt 1 sind mit dem echten PDF-Renderer
(Chromium auf dem Server) gemessen, nicht geschätzt.

## 1. Befunde aus den Grenzfall-Tests

### 1.1 Wie das Etikett auf Textlänge reagiert

Die Schrift schrumpft automatisch, bis der Text passt. Feste Spannen:

| Feld | Größte Schrift | Kleinste Schrift | Erlaubte Zeichen heute |
|---|---|---|---|
| Name (Titel) | 15 pt | 8,5 pt | 60 |
| Beschreibung + Zutaten | 7,4 pt | 5,2 pt | 600 + 400 |
| Teeart | 6,4 pt fest, keine Anpassung | – | 40 |
| Fußzeile (Shopname, URL) | 5,6 pt fest | – | per Konfiguration |

**Beschreibung** (mit kurzer Zutatenliste von 18 Zeichen):

| Zeichen | Schriftgröße | Ergebnis |
|---|---|---|
| bis 200 | 7,4 pt | passt in voller Größe |
| 250 | 7,0 pt | leicht verkleinert |
| 300 | 6,8 pt | verkleinert |
| 350 | 6,2 pt | deutlich kleiner |
| 400 | 5,4 pt | kaum noch lesbar |
| ab ca. 430 | 5,2 pt | **passt nicht mehr**, Warnung |

**Zutaten** (bei 200 Zeichen Beschreibung): 100 Zeichen ergeben 7,0 pt, 200 Zeichen 6,2 pt,
300 Zeichen 5,6 pt. Ab ca. 380 Zeichen passt es nicht mehr.

**Name:**

| Beispiel | Zeichen | Ergebnis |
|---|---|---|
| China Sencha | 12 | 15 pt, eine Zeile |
| Earl Grey Blue Flower | 21 | 14,2 pt, zwei Zeilen |
| Rooibos Vanille-Karamell | 24 | 13,4 pt, zwei Zeilen |
| Japan Gyokuro Asahi Premium Qualität | 36 | 10,8 pt, zwei Zeilen |
| Schwarztee Weihnachtsmischung Zimt Orange … | 62 | **passt nicht**, Warnung |
| Rotbuschteespezialmischung | 26, ein Wort | **passt nicht**, Warnung |

Lange zusammengesetzte Einzelwörter sind der kritischste Fall: Ein Wort ohne Leerzeichen oder
Bindestrich passt schon ab etwa 22 Großbuchstaben nicht mehr in die Breite.

### 1.2 Gefundene Fehler und Schwächen

Nach Dringlichkeit sortiert. Keiner davon ist bisher behoben.

1. **Zutaten möglicherweise zu klein für die Lebensmittelkennzeichnung.** Die LMIV verlangt für
   Pflichtangaben eine x-Höhe von mindestens 1,2 mm, bei Verpackungen mit größter Fläche unter
   80 cm² mindestens 0,9 mm. Die Zutaten haben schon in voller Größe nur 1,04 mm, beim Schrumpfen bis
   0,73 mm. Die Beschreibung erreicht 1,2 mm nur bis 7,2 pt. Ob das relevant ist, hängt von
   Frage 2.1 ab.
2. **Silbentrennung unterschiedlich in Vorschau und PDF.** Das Chromium auf dem Server hat keine
   deutschen Trennmuster, trennt also nie. Chrome am Laden-PC trennt dagegen. Dann passt ein Text in
   der Vorschau in größerer Schrift als im PDF, im Extremfall zeigt die Vorschau keine Warnung, das
   PDF schneidet aber ab. Lösung: Trennstellen selbst berechnen (Bibliothek mit deutschen Mustern)
   und als weiche Trennstriche in Vorschau und PDF gleich einsetzen.
3. **Teeart wird ab ca. 25 Zeichen stillschweigend abgeschnitten.** Erlaubt sind 40 Zeichen, eine
   Warnung gibt es nicht. Beispiel: „Aromatisierter Schwarzer Tee mit Stücken“.
4. **Überlauf nur als Hinweis.** Die Warnung erscheint im Editor, das PDF wird trotzdem mit
   abgeschnittenem Text erzeugt. Der Server erkennt den Überlauf bereits, nutzt ihn aber nicht.
5. **Lange Einzelwörter im Namen** passen nicht (siehe Tabelle). Lösung wie bei Punkt 2 über
   Trennstellen, zusätzlich engere Laufweite bei kleiner Schrift.
6. **Zeichenlimits passen nicht zum Platz.** 600 Zeichen Beschreibung sind erlaubt, ab 430 passt es
   nicht. Besser: eine Platzanzeige („Etikett zu 80 % gefüllt“) statt fester Zeichenzahlen.
7. **Zeilenumbrüche in der Beschreibung werden ignoriert.** Absätze aus dem Textfeld erscheinen auf
   dem Etikett als Fließtext. Entweder Umbrüche übernehmen oder im Formular verhindern.
8. **Helle Farben machen Text unlesbar.** Bei hellem Gelb sind Teeart, „Zutaten:“ und Rahmen kaum zu
   sehen. Lösung: Kontrast prüfen und Textfarben automatisch abdunkeln.
9. **Sonderzeichen.** Die Schriften enthalten nur westeuropäische Zeichen. Ō, Ł, Č oder ő erscheinen in
   einer Ersatzschrift. Chinesische Zeichen und Emoji werden auf dem Server-Image als leere Kästchen
   gedruckt, weil dort keine passenden Schriften installiert sind. Lösung: erweiterten
   Zeichensatz der Schriften einbinden und nicht druckbare Zeichen bei der Eingabe ablehnen.
10. **Gelöschter Drucker.** Wird ein Drucker gelöscht, während jemand die Druckseite offen hat, druckt
    die App ohne Rückmeldung mit dem Standarddrucker und dessen Korrektur.
11. **Druckdialog-Skalierung.** Wählt jemand „An Seite anpassen“, ist der ganze Bogen verschoben. Die
    App kann das nicht erkennen, nur durch Hinweise und Testbogen auffangen.
12. **Äußerer Druckrand.** Die äußeren Etiketten beginnen 0,5 mm vom Papierrand, Bürodrucker drucken
    meist erst ab 3 bis 5 mm. Der Rahmen fehlt dort dann teilweise.

### 1.3 Leistung

| Umfang | Dauer | PDF-Größe |
|---|---|---|
| 1 Bogen (12 Etiketten) | 0,3 s | 0,4 MB |
| 5 Bögen | 0,7 s | 2,1 MB |
| 20 Bögen (Maximum) | 2,6 s | 8,5 MB |
| 5 Bögen gleichzeitig von verschiedenen Nutzern | 0,5 s | – |

Für einen Laden ist das unkritisch. Die Dateigröße ließe sich bei Bedarf deutlich verkleinern.

## 2. Offene Fragen an dich

### 2.1 Recht und Pflichtangaben (wichtigste Fragen)

1. **Wird der Tee als Fertigpackung verkauft** (vorher abgefüllt und verschlossen) oder vor den Augen
   der Kundschaft lose abgefüllt? Davon hängt ab, welche Angaben auf das Etikett müssen.
2. **Welche Pflichtangaben brauchst du?** Für Fertigpackungen sind das in der Regel Bezeichnung,
   Zutaten mit hervorgehobenen Allergenen, Füllmenge, Mindesthaltbarkeitsdatum, Los-Kennzeichnung
   sowie Name und Anschrift. Bitte rechtlich prüfen lassen, zum Beispiel bei der IHK oder der
   Lebensmittelüberwachung.
3. **Wie groß ist die größte Fläche der Verpackung** (Tüte, Dose)? Über oder unter 80 cm²
   entscheidet über die Mindestschriftgröße 1,2 mm bzw. 0,9 mm x-Höhe.
4. **Allergene** wie Milch, Nüsse, Mandeln oder Soja in Teemischungen müssen in der Zutatenliste
   hervorgehoben werden. Kommen solche Mischungen vor?
5. **Bio-Tees:** Gibt es Bio-Ware? Dann gehören Öko-Kontrollstellen-Nummer und ggf. Bio-Logo aufs
   Etikett.
6. **Pro Druck oder pro Sorte:** Ändern sich MHD, Los oder Füllmenge mit jeder Abfüllung? Dann
   braucht das Druckfeld zusätzliche Eingaben.

### 2.2 Etikett und Design

7. **Gefällt dir das neue Design** grundsätzlich? Wünsche zu Logo, Hausfarben, Schriften, dem
   Briefmarkenrand des alten Designs?
8. **Eine Tasse für alle** oder verschiedene Illustrationen je Teeart, z. B. Kräuter, Früchte,
   Rooibos? Oder eigene Bilder pro Sorte hochladen?
9. **Welche Inhalte fehlen?** Typisch auf Tee-Etiketten: Zubereitung (Menge, Wassertemperatur,
   Ziehzeit), Herkunft, Füllmenge, Preis, Barcode bzw. EAN für die Kasse, QR-Code zum Onlineshop.
10. **Längste echte Texte:** Wie lang sind deine längsten Namen und Beschreibungen? Daran richten
    sich die Grenzen aus Abschnitt 1.1 aus.
11. **Was soll bei zu langem Text passieren?** Bis zur kleinsten Schrift schrumpfen und dann
    blockieren, oder lieber früher blockieren, damit alles gut lesbar bleibt?
12. **Absätze in der Beschreibung** gewünscht oder immer Fließtext?
13. **Fußzeile:** Reicht „Tee-Treff-Punkt · www.teetreffpunkt.de“ oder gehört die Anschrift dazu?

### 2.3 Bogen und Drucker

14. **Welche Etikettenbögen genau?** Hersteller und Artikelnummer, damit das Raster aus dem
    Datenblatt statt aus dem alten PDF kommt.
15. **Welche Drucker** (Modell, Laser oder Tinte) stehen im Laden? Kann einer randlos drucken?
16. **Gemischte Bögen:** Sollen verschiedene Tees auf einen Bogen passen, z. B. 4 × Sencha und
    8 × Assam?

### 2.4 Bedienung und Betrieb

17. **Welche Geräte nutzt das Personal?** Windows-PC mit Chrome, Mac, iPad? Das beeinflusst Vorschau
    und Druckdialog.
18. **Gemeinsames Passwort oder eigene Zugänge?** Sollen nur bestimmte Personen Drucker kalibrieren
    oder Tees löschen dürfen? Braucht es ein Änderungsprotokoll?
19. **Wie viele Sorten** gibt es heute? Sollen die bestehenden PSD- bzw. PDF-Etiketten übernommen
    werden? Die Texte daraus lassen sich automatisch auslesen.
20. **Welches Shopsystem** läuft unter teetreffpunkt.de? Bei Shopify oder einem anderen System mit
    Schnittstelle könnten Sorten und Texte direkt übernommen werden.
21. **Domain:** Bleibt es vorerst bei sslip.io oder kommt eine eigene Subdomain?
22. **Datensicherung:** Wohin sollen die täglichen Sicherungen zusätzlich kopiert werden?

## 3. Feature-Ideen

Aufwand: S = bis 1 Tag, M = 2 bis 4 Tage, L = 1 Woche und mehr.

### 3.1 Als Nächstes: Grenzfälle absichern

| Feature | Nutzen | Aufwand |
|---|---|---|
| Eigene Silbentrennung mit deutschen Mustern für Vorschau und PDF | Vorschau = Druck auch bei langen Wörtern | S |
| Teeart und Fußzeile automatisch anpassen | kein stilles Abschneiden mehr | S |
| PDF bei Überlauf verweigern oder deutlich warnen | kein Fehldruck mit abgeschnittenem Text | S |
| Platzanzeige statt Zeichenzähler, Grenzen nach echten Messwerten | Personal sieht sofort, wie viel noch passt | S |
| Mindestschriftgröße je nach Pflichtangabe (z. B. Zutaten ≥ 1,2 mm x-Höhe) | rechtssichere Lesbarkeit | S |
| Kontrastprüfung, Textfarbe bei hellen Farben automatisch dunkler | lesbare Etiketten bei jeder Farbe | S |
| Zeichensatz erweitern, Emoji und nicht druckbare Zeichen abfangen | keine Kästchen im Druck | S |
| Zeilenumbrüche übernehmen oder unterbinden | keine Überraschung bei Absätzen | S |

### 3.2 Inhalte und Recht

| Feature | Nutzen | Aufwand |
|---|---|---|
| Felder für Füllmenge, MHD, Los pro Druckauftrag, MHD automatisch aus Haltbarkeit in Monaten | Pflichtangaben ohne Handarbeit | M |
| Allergene in den Zutaten hervorheben (z. B. `*Mandeln*` wird fett) | LMIV-Vorgabe | S |
| Zubereitungsempfehlung mit Symbolen: Gramm, °C, Minuten | häufigster Kundenwunsch auf Tee-Etiketten | M |
| Bio-Kennzeichnung mit Kontrollstellen-Nummer | Pflicht bei Bio-Ware | S |
| Preis, Barcode (EAN) und QR-Code zum Shop | Kasse und Nachbestellung | M |

### 3.3 Bedienung

| Feature | Nutzen | Aufwand |
|---|---|---|
| Tee duplizieren („als Vorlage kopieren“) | neue Mischungen schneller anlegen | S |
| Archivieren statt Löschen, Papierkorb | keine versehentlich verlorenen Sorten | S |
| Gemischte Bögen: mehrere Tees auf einem Bogen | Bögen voll ausnutzen | M |
| Angebrochene Bögen merken („bei Drucker X ab Feld 7“) | weniger Nachzählen | S |
| Letzten Drucker pro Gerät merken | weniger Klicks | S |
| PDF-Vorschau direkt in der Seite statt neuem Tab | einfacher auf Tablets | S |
| Import und Export als CSV oder Excel | Ersterfassung und Datensicherung | M |
| Übernahme der bestehenden Photoshop-PDFs per Texterkennung | alte Sorten nicht abtippen | M |

### 3.4 Gestaltung

| Feature | Nutzen | Aufwand |
|---|---|---|
| Mehrere Illustrationen je Teeart oder eigenes Bild pro Sorte | mehr Abwechslung im Regal | M |
| Mehrere Vorlagen (z. B. Standard, Saisonal, Geschenk) | flexibel für Aktionen | M |
| Grafischer Editor: Elemente per Maus verschieben, Schriften und Größen ändern | Gestaltung ohne Entwickler | L |
| Weitere Bogenformate (andere Etikettengrößen, Rundetiketten) | andere Verpackungen | M |

### 3.5 Betrieb und Integration

| Feature | Nutzen | Aufwand |
|---|---|---|
| Eigene Zugänge mit Rollen (Personal, Admin) und Änderungsprotokoll | Nachvollziehbarkeit, Schutz der Kalibrierung | M |
| Anmeldeschutz gegen Durchprobieren (Sperre nach Fehlversuchen) | Sicherheit bei öffentlicher Adresse | S |
| Synchronisation mit dem Onlineshop (Texte, Preise, Bilder) | Daten nur an einer Stelle pflegen | L |
| Direktdruck ohne Druckdialog über einen kleinen Druckdienst im Laden | keine falsche Skalierung mehr | L |
| Externe Sicherung (z. B. netcup Storage, S3) und Wiederherstellen per Oberfläche | Daten sicher bei Serverausfall | S |
| Automatische Updates per GitHub Actions | neue Versionen ohne SSH | M |

## 4. Vorschlag für die Reihenfolge

1. Fragen 2.1 klären, weil sie Datenmodell und Mindestschriftgrößen bestimmen.
2. Grenzfälle aus 3.1 beheben. Das ist wenig Aufwand und verhindert Fehldrucke.
3. Pflichtangaben und Zubereitung aus 3.2 umsetzen.
4. Bestandsdaten importieren (3.3), danach Bedienkomfort und Gestaltung nach Bedarf.
