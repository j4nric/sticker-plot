# Entscheidungen und Umsetzungsstand

Stand: 16.10.2026. Grundlage sind die Fragen und Feature-Ideen aus
[offene-fragen-und-features.md](offene-fragen-und-features.md) und deine Antworten.

## 1. Deine Antworten

| Frage | Antwort | Folge für die App |
|---|---|---|
| Fertigpackung? | Nein | Keine Pflichtangaben nach LMIV erzwungen. Füllmenge, MHD und Los sind optionale Druckangaben. |
| Größte Verpackungsfläche | Sticker haben feste Größe (siehe PDF) | Keine gesetzliche Mindestschrift. Mindestgröße nach Lesbarkeit festgelegt (siehe unten). |
| Bögen und Drucker | über Einstellungen in der App anpassbar | Bogenformate und Druckerkalibrierung vollständig in der Verwaltung pflegbar. |
| Bestand | mindestens 100 Sorten, Import aus PDFs gewünscht | PDF-Import per Texterkennung mit Prüfliste und Kommandozeilen-Werkzeug. |
| Längste Texte | vorerst nicht relevant | Grenzen ergeben sich aus dem Platz; die Platzanzeige zeigt sie live. |

## 2. Meine Entscheidungen zu den übrigen Fragen

| Thema | Entscheidung | Begründung |
|---|---|---|
| Design | Neues Design bleibt, alter Briefmarkenrahmen entfällt | Klarer, vektorbasiert, druckt sauber; zwei weitere Varianten als Vorlagen. |
| Motive | Tasse, Kanne, Kräuterzweig, Früchte, automatisch nach Teeart; eigenes Bild möglich | Mehr Abwechslung ohne Pflegeaufwand. |
| Zusätzliche Inhalte | Zubereitung, Bio, Preis, EAN, QR-Code, Allergen-Hervorhebung | Typisch für Tee-Etiketten, alles optional. |
| Zu langer Text | PDF wird verweigert, „Trotzdem erstellen“ möglich; in den Einstellungen auf „nur warnen“ umstellbar | Verhindert Fehldrucke, lässt aber Ausnahmen zu. |
| Kleinste Schrift | Text 5,6 pt (vorher 5,2 pt), Titel 8,5 pt | Messung: unter 5,6 pt auf Bürodruckern kaum lesbar. In Vorlagen einstellbar. |
| Absätze | Leerzeilen in der Beschreibung werden übernommen | Erwartung beim Tippen im Textfeld. |
| Fußzeile | Shopname und Internetadresse, optional Anschrift als zweite Zeile | In den Einstellungen änderbar. |
| Bogengeometrie | Standard aus deinem Beispiel-PDF, weitere Formate anlegbar | Kalibrierung gleicht Abweichungen aus. |
| Gemischte Bögen | Ja, als „Sammeldruck“ | Angebrochene Bögen besser nutzen. |
| Geräte | PC-Browser als Hauptgerät, Tablet und Handy bedienbar | Responsive Oberfläche, getestet bei 390 px Breite. |
| Zugänge | Eigene Benutzer mit Rollen „Personal“ und „Administrator“ | Nachvollziehbarkeit im Protokoll, Schutz der Verwaltung. |
| Shopsystem | unbekannt, daher CSV-Import und -Export | Funktioniert mit jedem System und Excel. |
| Domain | sslip.io, später jederzeit wechselbar | Kostenlos, ohne Anmeldung. |
| Datensicherung | Tägliche Sicherung auf dem Server plus Download und Wiederherstellen in der App | Bilder liegen in der Datenbank, eine Datei sichert alles. |

## 3. Umgesetzt

### Grenzfälle (aus den Messungen)

| Problem vorher | Lösung |
|---|---|
| Silbentrennung im Server-Chromium fehlte, Vorschau ≠ PDF | Eigene deutsche Silbentrennung setzt weiche Trennstriche; Vorschau und PDF trennen identisch. |
| Lange Einzelwörter im Namen passten nicht | Werden jetzt getrennt, z. B. „ROTBUSCHTEESPE-ZIALMISCHUNG“. |
| Teeart wurde ab 25 Zeichen still abgeschnitten | Schrumpft und bricht bei Bedarf zweizeilig um. |
| Überlauf nur als Hinweis, PDF trotzdem abgeschnitten | PDF wird verweigert, mit Option „Trotzdem erstellen“. |
| Bei Überlauf fehlte der Textanfang | Text bleibt oben ausgerichtet, sobald er überläuft. |
| Feste Zeichenlimits passten nicht zum Platz | Platzanzeige mit Textgröße; großzügige technische Grenzen. |
| Zeilenumbrüche gingen verloren | Absätze werden übernommen. |
| Helle Farben unlesbar | Schrift und Linien werden automatisch auf Kontrast 4,5 : 1 abgedunkelt, sehr helle Flächen leicht. |
| Sonderzeichen in Ersatzschrift, Emoji als Kästchen | Schriften mit erweitertem Zeichensatz (Ł, Ő, Č …); nicht druckbare Zeichen werden bei der Eingabe abgelehnt. |
| Gelöschter Drucker wurde still ersetzt | Klare Fehlermeldung. |
| Druckdialog skaliert | PDF gibt „keine Skalierung“ vor (wirkt in Acrobat und vielen Druckdialogen). |

### Funktionen

| Feature | Stand |
|---|---|
| PDF-Import alter Etiketten (Texterkennung, Prüfliste, Kommandozeile) | umgesetzt |
| Bogenformate in der Verwaltung, Design passt sich an andere Etikettgrößen an | umgesetzt |
| Zubereitung mit Symbolen | umgesetzt |
| Allergene fett (`*Mandeln*`) | umgesetzt |
| Bio-Kennzeichnung mit Kontrollstelle | umgesetzt (als Text, ohne EU-Bio-Logo) |
| Füllmenge, MHD, Los pro Druck; MHD-Vorschlag aus Haltbarkeit | umgesetzt |
| Preis, EAN-Strichcode mit Prüfziffer, QR-Code | umgesetzt |
| Duplizieren, Archiv mit Wiederherstellen | umgesetzt |
| Sammeldruck mehrerer Sorten | umgesetzt |
| Startfeld pro Drucker merken, „Neuer Bogen“ | umgesetzt |
| Drucker und Format pro Gerät merken | umgesetzt |
| PDF-Vorschau im Dialog | umgesetzt |
| CSV-Import und -Export (Excel-kompatibel) | umgesetzt |
| Motive je Teeart, eigenes Bild hochladen | umgesetzt |
| Vorlagen mit drei Varianten und Vorlagen-Editor mit Live-Vorschau | umgesetzt |
| Benutzer, Rollen, Änderungsprotokoll, Passwort ändern | umgesetzt |
| Sperre nach fünf Fehlversuchen | umgesetzt |
| Sicherung herunterladen und wiederherstellen | umgesetzt |
| Tests und Build bei jedem Push (GitHub Actions) | umgesetzt |
| Automatisches Deployment per GitHub Actions | umgesetzt, wartet auf Secrets |
| Installationsskript ohne Rückfragen | umgesetzt |

## 4. Nicht oder anders umgesetzt

| Feature | Stand | Grund |
|---|---|---|
| Freier Drag-and-drop-Editor | ersetzt durch Vorlagen-Editor | Vorlagen mit Variante, Schriften, Größen, Motivhöhe und Elementen decken den Bedarf ab und bleiben robust; freies Verschieben hätte die automatische Textanpassung unzuverlässig gemacht. |
| Synchronisation mit dem Onlineshop | nicht umgesetzt | Shopsystem und Zugang unbekannt; CSV-Import/-Export als Brücke. |
| Direktdruck ohne Druckdialog | nicht umgesetzt | Bräuchte einen Druckdienst im Ladennetz, weil der Server den Drucker nicht erreicht. Ersatz: Druckvorgabe „keine Skalierung“ im PDF. |
| Rundetiketten | nicht umgesetzt | Rechteckige Formate decken den Bestand ab. |
| Excel-Dateien (.xlsx) | als CSV umgesetzt | CSV öffnet und speichert Excel direkt, ohne zusätzliche Abhängigkeit. |
| Externe Sicherung (z. B. S3) | ersetzt durch Download in der App | Kein Zugang zu einem externen Speicher vorhanden. |
| EU-Bio-Logo | nur Text „BIO · DE-ÖKO-…“ | Das Logo unterliegt Gestaltungsvorgaben; als Datei hochladbar, wenn gewünscht. |

## 5. Geprüft und nicht geprüft

**Geprüft:**

- 61 automatische Tests: Logik, Datenbank, PDF-Erzeugung mit Chromium.
- Browser-Durchlauf mit 49 Prüfungen gegen den Produktions-Build: Anmeldung und Sperre, Editor mit
  allen Feldern, Bild-Upload, Drucken mit Startfeld und Überlaufsperre, Duplizieren, Archiv,
  Sammeldruck, alle Verwaltungsseiten, PDF- und CSV-Import, Rollen.
- Migration einer Datenbank der ersten Version: Tees, Drucker und Kalibrierung bleiben erhalten.
- Texterkennung mit deinem Beispiel „CHINA_SENCHA_new.pdf“: alle Felder richtig, auch ohne
  aussagekräftigen Dateinamen, etwa 2,5 Sekunden pro Datei.

**Nicht geprüft:**

- Der Docker-Build konnte in der Entwicklungsumgebung nicht vollständig laufen, weil dort die
  Debian-Paketserver und der Chromium-Download gesperrt sind. Auf deinem Server lief die erste
  Version bereits erfolgreich; die neuen Pakete kommen alle aus npm.
- Das automatische Deployment ist ungetestet, bis die Secrets eingetragen sind.
- Die Texterkennung kennt nur ein Beispiel. Weichen andere alte PDFs im Layout ab, sinkt die
  Erkennungsqualität; die Prüfliste zeigt das über die Prozentwerte und Warnungen an.
