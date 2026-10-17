# Bedienung für das Ladenpersonal

## Anmelden

Die Adresse der App im Browser öffnen und mit Benutzername und Passwort anmelden. Die Zugänge legt
der Administrator unter **Verwaltung → Benutzer** an. Nach fünf falschen Versuchen ist die Anmeldung
für diesen Namen zehn Minuten gesperrt. Das eigene Passwort lässt sich über den Namen oben rechts
ändern.

## Etiketten drucken

1. Unter **Tees** den Tee anklicken oder suchen.
2. Rechts unter **Drucken** Drucker und, falls es mehrere gibt, das Bogenformat wählen. Die Auswahl
   merkt sich der Browser.
3. **Anzahl Etiketten** eintragen.
4. **Erstes freies Feld:** Die App merkt sich pro Drucker, wo der letzte Druck aufgehört hat. Liegt
   ein neuer Bogen im Drucker, auf **Neuer Bogen** tippen. Verbrauchte Felder sind grau
   durchgestrichen, bedruckte grün.
5. Optional unter **Druckangaben** Füllmenge, Mindesthaltbarkeit und Los eintragen. Ist bei der Sorte
   eine Haltbarkeit hinterlegt, wird das MHD vorgeschlagen.
6. **Vorschau** zeigt das PDF in der Seite, **PDF erstellen** öffnet es in einem neuen Tab.
7. Im Druckdialog **Tatsächliche Größe** bzw. **100 %** wählen. Das PDF gibt das bereits vor, nicht
   jedes Programm hält sich aber daran.

Passt ein Text nicht aufs Etikett, wird kein PDF erstellt. Die Seite erklärt den Grund und bietet
„Trotzdem erstellen“ an; dann wird der Text abgeschnitten.

### Mehrere Sorten auf einem Bogen

Unter **Sammeldruck** die Sorten mit Anzahl wählen, zum Beispiel 4 × Sencha und 3 × Assam. Die
Etiketten werden in dieser Reihenfolge ab dem ersten freien Feld verteilt.

## Tee anlegen oder ändern

1. Unter **Tees** auf **+ Neuer Tee** klicken.
2. Name, Teeart, Beschreibung und Zutaten eintragen.
   - Bekannte Teearten setzen Farbe und Motiv automatisch.
   - Leerzeilen in der Beschreibung werden als Absatz übernommen.
   - Allergene in den Zutaten mit Sternchen markieren: `*Mandeln*` wird fett gedruckt.
3. Optional: Zubereitung (Menge, Temperatur, Ziehzeit), unter **Weitere Angaben** Bio, Preis,
   Strichcode (EAN), Link für einen QR-Code und Haltbarkeit in Monaten.
4. Unter **Gestaltung** Vorlage und Motiv wählen. Nach dem Anlegen lässt sich ein eigenes Bild
   hochladen, das dann das Motiv ersetzt.
5. Die Vorschau rechts zeigt das Etikett genau so, wie es gedruckt wird. Darunter zeigt die
   **Platzanzeige**, wie eng der Text schon ist.
6. Gelbe Hinweise beachten: Text zu lang oder Zeichen, die nicht gedruckt werden können
   (zum Beispiel Emoji).
7. **Tee anlegen** bzw. **Änderungen speichern**. Gedruckt werden kann erst nach dem Speichern.

**Duplizieren** legt eine Kopie an, praktisch für ähnliche Mischungen. **Archivieren** blendet eine
Sorte aus; im Archiv lässt sie sich wiederherstellen. Endgültig löschen darf nur ein Administrator.

## Drucker einrichten (einmal pro Drucker)

Jeder Drucker zieht das Papier etwas anders ein. Mit dem Testbogen wird das ausgeglichen.

1. Unter **Drucker** den Drucker öffnen, bei mehreren Formaten das Bogenformat wählen und
   **Testbogen als PDF öffnen**.
2. Den Testbogen in tatsächlicher Größe auf einen **leeren Etikettenbogen** drucken.
3. An Kreuz **A** und Kreuz **B** ablesen, bei welchem Strich die echte Etikettkante die Skala
   schneidet. Jeder Strich ist 1 mm.
   - waagerechte Skala = X, senkrechte Skala = Y
   - links bzw. oberhalb der Mitte negativ, rechts bzw. unterhalb positiv, genau auf der Mitte 0
4. Die vier Werte eintragen und **Korrektur berechnen und speichern**.
5. Einen neuen Testbogen drucken. Sitzen beide Kreuze auf den Ecken, ist der Drucker fertig.
   Sonst die neuen Ablesewerte eintragen; sie werden zur bisherigen Korrektur dazugerechnet.

Die Randmarken an den Papierkanten zeigen, ab wie vielen Millimetern der Drucker überhaupt druckt.

## Für Administratoren: Verwaltung

| Bereich | Wofür |
|---|---|
| Import | Alte Photoshop-PDFs hochladen, erkannte Daten prüfen und übernehmen; CSV-Import und -Export |
| Vorlagen | Gestaltung: Variante, Schriften, Schriftgrößen, Motivhöhe, sichtbare Elemente |
| Bogenformate | Papiergröße und Etikettenraster für andere Etikettenbögen |
| Einstellungen | Shopname, Internetadresse, Anschrift, Öko-Kontrollstelle, Verhalten bei zu langem Text |
| Benutzer | Zugänge anlegen, Rollen, Passwörter, deaktivieren |
| Protokoll | Wer hat wann was geändert |
| Sicherung | Datenbank herunterladen, Sicherung anlegen oder wiederherstellen |

### Alte Etiketten importieren

1. **Verwaltung → Import**, unter „Alte Etiketten (PDF) übernehmen“ alle PDFs auf einmal auswählen.
2. Die Dateien werden hochgeladen und nacheinander gelesen, etwa zwei bis drei Sekunden pro Datei.
3. Jedes Ergebnis erscheint mit Bild des alten Etiketts. Die Prozentzahlen zeigen, wie sicher die
   Erkennung ist. Felder bei Bedarf korrigieren und **Übernehmen**.
4. Gibt es den Namen schon, wird das angezeigt. Mit „trotzdem zusätzlich anlegen“ entsteht eine
   zweite Sorte.
5. **Alle ohne Warnung übernehmen** spart bei vielen Dateien Zeit: Nur sicher erkannte, neue Sorten
   werden angelegt, der Rest bleibt zur Prüfung stehen.
