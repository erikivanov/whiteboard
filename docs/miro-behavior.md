# Miro: beobachtetes Verhalten und Abnahmetests

## Rahmen und Methode

Untersuchung am 29.10.2026, ca. 17:40–17:43 UTC (18:40–18:43 Berlin), über den Playwright-MCP-Server im vom Benutzer geöffneten Chromium. Deutsche Oberfläche, Free-Preisplan, Board „Unbenanntes Board“: https://miro.com/app/board/uXjVETlzPf4=/ . Der Benutzer hatte ein leeres Testboard geöffnet und Erstellen, Bearbeiten und Löschen autorisiert. Es wurde keine Anwendung entwickelt.

Die Ergebnisse stammen aus UI-Aktionen, Accessibility-Snapshots und Screenshots, ohne Zugriff auf interne Board-Daten oder Miro-APIs. Koordinaten sind CSS-Pixel des jeweiligen Viewports. Die Fenstergröße änderte sich während der Untersuchung von etwa 1200 × 1162 auf 1707 × 1205; Koordinaten sind deshalb Beispiele, keine stabilen Selektoren. Vor Wiederholung neue Bildschirmpositionen ermitteln. Animationsende abwarten, bevor Positionen verglichen werden.

KI-Seitenpanel und Benachrichtigungsbanner wurden geschlossen. Anfangs betrug der Zoom 100 %, Undo und Redo waren deaktiviert. Einmalige explorative Durchführung; keine Aussage über sämtliche Varianten oder dauerhafte Speicherung nach Neuladen.

## Tatsächlich beobachtet

### Notizzettel

- „Notiz“ öffnet eine Palette mit 16 benannten Farben sowie „Block“. Die übrigen Farben und Block wurden nur angezeigt, nicht ausprobiert.
- Auswahl „hellgelbe Notiz anbringen“ und Klick bei (380,360) erzeugten eine quadratische hellgelbe Notiz von ungefähr 100 × 100 Bildschirm-Pixeln bei 100 %. Der Texteditor wurde sofort geöffnet; der Snapshot meldete die Erstellung.
- Tastatureingabe erzeugte „Testnotiz A“, sichtbar zentriert und automatisch umgebrochen. Doppelklick, Cmd+A im Editor und neue Eingabe ersetzten den Inhalt durch „Notiz A geändert“. Escape beendete die Bearbeitung.
- Ziehen aus der Notizmitte von ungefähr (380,350) nach (420,450) verschob die Notiz, ohne ihren Inhalt zu ändern.
- Eine kontextuelle Werkzeugleiste bot unter anderem Schriftgröße „Automatisch“, Notizgröße S und Füllfarbe an. Diese Einstellungen wurden nicht geändert.

### Formen

- „Formen und Linien“ bot Rechteck, Oval, Raute und Dreieck sowie Linienvarianten an. Praktisch getestet wurde das Rechteck.
- Rechteck auswählen und von (650,300) nach (850,420) ziehen erzeugte ein ungefähr 200 × 120 Pixel großes Rechteck mit schwarzem Rand und sichtbar durchscheinendem Raster.
- Doppelklick im Inneren öffnete einen Editor. „Form B“ wurde in der Mitte dargestellt.
- Ziehen im Inneren von (750,360) nach (850,480) verschob das Rechteck. Eine bereits angeschlossene Verbindung blieb am linken Rand angeheftet.
- Einfachklick zeigte einen Auswahlrahmen mit Eckgriffen. Ziehen des unteren rechten Griffs von ungefähr (1242,769) nach (1320,820) vergrößerte das Rechteck nach rechts und unten; Beschriftung blieb mittig und Verbindung folgte dem Rand.

### Freier Text

- „Text“ und Klick bei (360,620) öffneten einen Editor mit Platzhalter „Hier eintragen …“.
- Eingabe „Freier Text“, Enter, „Zweite Zeile“ ergab ein eigenständiges Textobjekt. Wegen der schmalen Textbreite wurde „Zweite Zeile“ zusätzlich visuell auf zwei Zeilen umgebrochen. Expliziter Absatz und automatischer Umbruch sind daher zu unterscheiden.
- Nach Escape waren Auswahlrahmen und Griffe sichtbar; Klick auf freie Fläche hob die Auswahl auf.
- Doppelklick und Cmd+A im Texteditor ersetzten den Inhalt später durch „Text geändert“. Auch dieser Text wurde wegen der schmalen Breite umgebrochen.

### Verbindungslinie

- „Pfeillinie platzieren“ und Ziehen vom rechten Notizrand nahe (470,450) zum linken Rechteckrand bei (650,360) erzeugten einen gekrümmten Pfeil von der Notiz zur Form.
- Im ausgewählten Zustand waren Endpunkte und ein mittlerer Griff blau sichtbar. Die Kontextleiste zeigte unter anderem Anfang „Ohne“, Pfeilende, Typ und Farbe. Diese Optionen wurden nicht verändert.
- Beim Verschieben des Rechtecks änderte die Verbindung automatisch ihren Verlauf; die Pfeilspitze blieb am linken Rechteckrand. Auch Größenänderung der Form aktualisierte den Verlauf.
- Escape ließ nach dem Erstellen die Linie ausgewählt; erst Klick auf freie Fläche entfernte die sichtbaren Auswahlmarkierungen.

### Auswahl, Mehrfachauswahl und Löschen

- Einfachklick auf ein Objekt zeigte einen blauen Auswahlrahmen und kontextabhängige Werkzeuge. Klick auf freie Fläche entfernte die Auswahl.
- Im Auswahlmodus erzeugte Ziehen auf freier Fläche von (320,280) nach (980,540) eine Auswahl von Notiz, Verbindung und Rechteck. Snapshot: „3 Elemente ausgewählt“, Menü: „Filter 3 Objekte“. Der darunterliegende Text blieb außerhalb.
- Ziehen aus der ausgewählten Notiz von (420,450) nach (460,510) verschob die drei Elemente gemeinsam um ungefähr (+40,+60). Ihr relativer Abstand blieb sichtbar erhalten.
- Backspace löschte die drei ausgewählten Elemente gemeinsam. Der freie Text blieb stehen.
- Nach dem späteren Verschieben der Zeichenfläche: Klick auf die Notiz bei (710,680), dann Shift-Klick auf das Rechteck bei (1140,710) ergab „2 Elemente ausgewählt“ und „Filter 2 Objekte“. Die Verbindung wurde dabei nicht als drittes Element mitgezählt.
- „Objekte gruppieren“ war in der Mehrfachauswahl vorhanden, wurde aber nicht betätigt. Mehrfachauswahl ist hier kein Nachweis für eine dauerhafte Gruppe.

### Zoom und Verschieben der Zeichenfläche

- Klick auf „Vergrößern“ änderte die Anzeige von 100 % auf 125 %. Objekte und Raster erschienen größer; feste Werkzeugleisten blieben bestehen. „Verkleinern“ führte wieder zu 100 %.
- Ein erster Leertaste-Ziehversuch nach Bedienung der Zoomleiste ergab keine sichtbare Verschiebung. Nach explizitem Klick auf freie Zeichenfläche funktionierte Leertaste halten, linke Maustaste ziehen, loslassen, Leertaste loslassen: Alle Objekte und das Raster verschoben sich gemeinsam nach rechts/unten, die Werkzeugleisten blieben stehen und Zoom blieb 100 %.
- Es wird kein exakter Pixel-zu-Board-Koordinatenfaktor aus diesem Versuch abgeleitet. Fokus, Fenstergrößenwechsel und Zoomanimation beeinflussten die Aufnahmen.

### Undo und Redo

- Nach dem Löschen der drei ausgewählten Elemente stellte ein Klick auf „Rückgängig machen“ alle drei an ihrer zuletzt gemeinsam verschobenen Position wieder her. Der freie Text blieb unverändert. Redo wurde danach bedienbar.
- Klick auf „Wiederherstellen“ entfernte dieselben drei Elemente erneut. Ein weiterer Undo-Klick stellte sie wieder her.
- Damit ist die gemeinsame Löschung als ein Undo-/Redo-Schritt beobachtet. Andere Operationen wurden nicht einzeln durch Undo/Redo zurückverfolgt.

### Besonderheiten der Automatisierung

- Die im Accessibility-Snapshot gemeldeten `textbox`-Elemente ließen sich mit Playwright `fill()` ohne Toolfehler befüllen, doch nach Verlassen des Editors waren Notiz und Form leer und kein freier Text sichtbar. Ein erfolgreicher Toolaufruf allein war also kein Nachweis einer erfolgreichen Boardbearbeitung.
- Doppelklick ins Objekt und `page.keyboard.insertText(...)` im aktiven Editor erzeugten dagegen sichtbaren Inhalt. Für Ersetzen funktionierte `Meta+a` innerhalb des Editors; für Absatz `Enter`. Diese Eingaben wurden per Screenshot überprüft.
- `browser_press_key` mit einer ganzen Zeichenfolge („Testnotiz A“) wurde vom MCP mit „Unknown key“ abgewiesen. Das ist eine Werkzeugbeschränkung, keine beobachtete Miro-Beschränkung.
- Browserkonsole meldete bereits zu Beginn 5 Fehler und 12 Warnungen; die Zähler blieben während der dokumentierten Tests gleich. Ursachen und Auswirkungen wurden nicht untersucht.

## Konkrete Abnahmetests

Diese manuellen Tests beschreiben das beobachtete Verhalten als prüfbare Erwartungen. „Bestätigt“ bezieht sich auf die beschriebene Sitzung, nicht auf automatisierte Regressionstests. Vorbedingung: bearbeitbares Testboard, Auswahlmodus, 100 %, keine aktive Texteingabe, freie Zeichenfläche; Positionen dem aktuellen Viewport anpassen.

| ID | Schritte | Erwartetes Ergebnis | Status |
| --- | --- | --- | --- |
| A01 | Notiz öffnen, Hellgelb auswählen, freie Fläche anklicken, „Testnotiz A“ per Tastatur eingeben, Escape, freie Fläche anklicken. | Genau eine hellgelbe Notiz mit sichtbar zentriertem, bei Bedarf umgebrochenem Text bleibt stehen. | Bestätigt |
| A02 | Notiz doppelklicken, Cmd+A im Editor, „Notiz A geändert“ eingeben, Escape; anschließend Notiz aus der Mitte ziehen. | Alter Text ist ersetzt; Notiz bewegt sich als Objekt und behält den neuen Text. | Bestätigt |
| A03 | Rechteckwerkzeug wählen, ungefähr 200 × 120 Pixel aufziehen; innen doppelklicken, „Form B“ eingeben, Escape. | Rechteck mit schwarzem Rand und mittiger Beschriftung entsteht. | Bestätigt |
| A04 | Textwerkzeug wählen, freie Fläche anklicken; „Freier Text“, Enter, „Zweite Zeile“ eingeben, Escape. | Eigenständiger Text mit Absatz bleibt sichtbar; zusätzliche Umbrüche dürfen durch die Textbreite entstehen. | Bestätigt |
| A05 | Text doppelklicken, Cmd+A im Editor, „Text geändert“ eingeben, Escape, freie Fläche anklicken. | Alter Text ist vollständig ersetzt; neues Textobjekt wird nicht zusätzlich angelegt. | Bestätigt |
| A06 | Pfeillinie wählen; vom rechten Notizrand zum linken Rechteckrand ziehen; freie Fläche anklicken. | Sichtbarer Pfeil führt von Notiz zu Rechteck. | Bestätigt |
| A07 | Verbundenes Rechteck aus der Mitte um etwa (+100,+120) ziehen. | Notiz bleibt stehen; Verbindung passt den Verlauf an und endet weiterhin am Rechteckrand. | Bestätigt |
| A08 | Rechteck anklicken, unteren rechten Eckgriff nach rechts/unten ziehen. | Breite und Höhe wachsen, Beschriftung bleibt mittig, angeschlossene Linie folgt dem Formrand. | Bestätigt |
| A09 | Im Auswahlmodus von freier Fläche einen Rahmen vollständig um Notiz, Linie und Rechteck ziehen; Text außerhalb lassen. | Drei Elemente werden ausgewählt, gemeinsamer Rahmen und „3 Objekte“ erscheinen; Text bleibt ausgeschlossen. | Bestätigt |
| A10 | Auswahl aus A09 aus der Notizmitte um etwa (+40,+60) ziehen. | Alle drei Elemente bewegen sich gemeinsam; relativer Abstand bleibt erhalten, Text bleibt stehen. | Bestätigt |
| A11 | Auswahl aus A10 mit Backspace löschen. | Notiz, Linie und Form verschwinden gemeinsam; Text bleibt stehen. | Bestätigt |
| A12 | Nach A11 Undo, dann Redo, dann Undo anklicken. | Drei Elemente kehren zusammen an ihre Position aus A10 zurück, verschwinden erneut und kehren erneut zurück. | Bestätigt |
| A13 | Freie Fläche anklicken, Notiz anklicken, Shift halten und Rechteck anklicken, Shift loslassen. | Zwei Elemente ausgewählt; Kontextmenü zeigt „2 Objekte“. | Bestätigt |
| A14 | Bei 100 % einmal Plus, danach einmal Minus anklicken; jeweils Animation abwarten. | Anzeige wechselt 100 → 125 → 100 %; sichtbare Objektgröße folgt dem Zoom. | Bestätigt |
| A15 | Freie Zeichenfläche anklicken; Leertaste halten und auf freier Fläche mit linker Maustaste nach rechts/unten ziehen; beide loslassen. | Raster und sämtliche Objekte bewegen sich gemeinsam, feste Leisten bleiben stehen, Zoom bleibt 100 %. | Bestätigt |
| A16 | Ein Objekt anklicken, danach freie Fläche anklicken. | Auswahlrahmen erscheint und verschwindet wieder. | Bestätigt |

## Annahmen und Ableitungen — nicht als geprüft behandeln

- Das beobachtete Mitwandern der Linie legt eine Bindung an die Objekte nahe. Ob intern feste Anker, dynamische Randpunkte oder andere Regeln verwendet werden, ist unbekannt.
- Der erfolgreiche zweite Pan-Versuch legt eine Fokusabhängigkeit nahe. Der erste Fehlschlag beweist keine allgemeine Regel für den Fokus auf jedem UI-Element.
- Das unveränderte Größenverhältnis beim Pan spricht für eine reine Ansichtsänderung. Interne Objektkoordinaten wurden nicht ausgelesen.
- Die Erwartungen der Abnahmetests sind aus einer Sitzung abgeleitet; sie sind keine vollständige Produktspezifikation und keine bereits implementierte Anwendung.

## Ungeprüfte Funktionen und Grenzen

- Andere Notizfarben, Farbänderungen, Notizgrößen, Schriftformatierung, Auto-Schriftgrößen bei langen Inhalten, Größenänderung von Notizen.
- Oval, Raute, Dreieck und weitere Formen; Seitenverhältnis mit Shift, Rotation, Rasterfang, Ausrichtungshilfen und exakte Größenfelder.
- Textbreite gezielt ändern, Schriftgröße/Farbe/Stil, Listen, Links, Einfügen über Zwischenablage, IME und Sonderzeichen über den getesteten Text hinaus.
- Gerade und gewinkelte Linien, freie Endpunkte, Endpunkte umhängen, Pfeilrichtung ändern, Linienbeschriftung, Farbe und Strichstärke; nur ein verbundenes Rechteck wurde einzeln bewegt.
- Teilüberlappende Auswahlrahmen, Auswahlrichtung, Shift-Abwahl, Cmd+A außerhalb des Editors, Gruppieren/Entgruppieren und Sperren.
- Mausrad-/Trackpad-Zoom, Zoom am Mauszeiger, direkte Prozentangabe, Zoomgrenzen, Fit-to-content, Minimap, Touch und andere Pan-Gesten.
- Undo/Redo von Textänderung, Erstellung, Verschieben, Größenänderung und Navigation; Tastaturkürzel für Undo/Redo; Redo-Verlust nach neuer Bearbeitung.
- Löschen nur eines verbundenen Endobjekts, einzelner Linien und Textobjekte; Verhalten verwaister Verbindungen.
- Neuladen, dauerhafte Speicherung, Mehrbenutzerbetrieb, Berechtigungen, andere Browser und Betriebssysteme.

## Belege und Endzustand

Die Screenshots liegen unter `docs/screenshots/`; Dateinamen enthalten UTC-Zeitpunkte. Sie zeigen Zustände, keine vollständigen Gesten. Die Aktionen und Auswahlzähler wurden zusätzlich durch Playwright-Snapshots geprüft.

| Aufnahme | Nachweis |
| --- | --- |
| [17:41:29](screenshots/page-2026-10-29T17-41-29-639Z.png) | Leere Notiz/Form nach erfolgloser `fill()`-Eingabe |
| [17:41:46](screenshots/page-2026-10-29T17-41-46-383Z.png) | Sichtbare Beschriftungen und freier mehrzeiliger Text nach Tastatureingabe |
| [17:42:04](screenshots/page-2026-10-29T17-42-04-635Z.png) | Geänderte/verschobene Notiz und ausgewählte Verbindung mit Griffen |
| [17:42:10](screenshots/page-2026-10-29T17-42-10-225Z.png) | Rechteck verschoben, Pfeil folgt |
| [17:42:11](screenshots/page-2026-10-29T17-42-11-490Z.png) | Drei Objekte gemeinsam ausgewählt |
| [17:42:16](screenshots/page-2026-10-29T17-42-16-276Z.png) | Drei Objekte gelöscht, Text bleibt |
| [17:42:17](screenshots/page-2026-10-29T17-42-17-433Z.png) | Undo stellt die gemeinsam verschobenen Objekte wieder her |
| [17:42:22](screenshots/page-2026-10-29T17-42-22-305Z.png) | Redo löscht erneut |
| [17:42:24](screenshots/page-2026-10-29T17-42-24-622Z.png) | Zoom 125 % |
| [17:42:32](screenshots/page-2026-10-29T17-42-32-340Z.png) | Ausgangsansicht bei 100 % vor erfolgreichem Pan |
| [17:42:37](screenshots/page-2026-10-29T17-42-37-666Z.png) | Zeichenfläche nach rechts/unten verschoben |
| [17:42:43](screenshots/page-2026-10-29T17-42-43-929Z.png) | Rechteck ausgewählt, Eckgriffe sichtbar |
| [17:42:52](screenshots/page-2026-10-29T17-42-52-391Z.png) | Endzustand: vergrößertes Rechteck, angepasster Pfeil, ersetzter Text |

Das Board bleibt als überprüfbares Testarrangement offen: hellgelbe Notiz „Notiz A geändert“, Rechteck „Form B“, verbundener Pfeil und freier Text „Text geändert“. Zoom 100 %, keine aktive Auswahl. Testobjekte wurden nach den Löschtests durch Undo wiederhergestellt.
