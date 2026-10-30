# Whiteboard – Livevergleich und Prüfstand

Aktualisiert am 29.10.2026 nach dem Livevergleich. **Aktive lokale URL: http://localhost:3001/**. Der vom Benutzer gestartete Next.js-Server wurde verwendet und nicht ersetzt oder beendet. Miro und Whiteboard sind in getrennten Tabs des sichtbaren Chromium geöffnet; die Miro-Anmeldung war vorhanden.

Die Originaldokumentation `miro-behavior.md` und die 13 ursprünglichen PNGs unter `screenshots/` bleiben unverändert. Neue Belege liegen getrennt unter [`comparison/`](comparison/index.html).

## Ergebnis und Nachweise

- **A01–A16: 16/16 bestanden**, durch tatsächliche Maus-/Tastaturaktionen über Playwright-MCP im sichtbaren Chromium auf Port 3001. Die Wiederholungen nach den Korrekturen sind in `scripts/live-acceptance.js` nachvollziehbar.
- Zusätzlich bestanden: die zehn Prüfgruppen in `scripts/live-settings.js` und die zwölf Prüfgruppen in `scripts/live-extra.js`. Letztere verwenden einen isolierten Browserkontext, damit Persistenz- und Importtests das sichtbare Vergleichsboard nicht ersetzen.
- Abschließende lokale Browserüberwachung im isolierten Kontext: **0 `pageerror`-Ereignisse, 0 Konsolenfehler, 0 fehlgeschlagene lokale Requests, 0 lokale HTTP-Antworten ab Status 400**.
- `npm run build`: erfolgreich, inklusive TypeScript und statischer Seitengenerierung. `npm run test:model`: **7/7 bestanden**.
- Maschinenlesbare Ergebnisse: [`comparison/test-results.json`](comparison/test-results.json). Vergleichsgalerie: [`comparison/index.html`](comparison/index.html).

Die Browserergebnisse stammen aus dem Playwright-MCP-Lauf, **nicht** aus einem erfolgreichen erneuten Aufruf des CLI-Runners `npm test`. Die reguläre Suite `tests/acceptance.spec.ts` wurde an mittige Notizplatzierung und die neue Palette angepasst und enthält weiterhin 23 registrierte Tests. Für einen vorhandenen Server kann sie mit `WHITEBOARD_BASE_URL=http://localhost:3001 npm test` ausgeführt werden. Der frühere CLI-Browserstartfehler wurde in dieser Sitzung nicht erneut provoziert; der sichtbare Browser war über MCP verfügbar.

## Verglichene Ansichten und Untersuchungsmethode

Beide Anwendungen wurden auf **1440 × 1000 CSS-Pixel** eingestellt. Für die Vergleichsaufnahmen wurde 100 % Boardzoom verwendet. Auf Miro wurden ausschließlich die bekannten Testobjekte und neu angelegte Testobjekte bearbeitet. Die lokale Vergleichsdatei `tests/fixtures/comparison.json` stellt deren sichtbare Positionen, Abmessungen und Inhalte nach; sie enthält keine aus privaten APIs bezogenen Daten.

Verglichen wurden:

| Ansicht / Verhalten | Untersuchung und Beleg |
| --- | --- |
| Normalzustand | Schwebende Board- und Aktionsleisten, Werkzeugleiste, Raster, Objekttexte und Zoomleiste; `*-scene-normal.png` |
| Hover / Werkzeugwahl | Berechneter Hintergrund, Mauszeiger, 40 × 40 große Werkzeugbuttons; `*-scene-hover.png` |
| Notizpalette | Alle 16 benannten Farben, Reihenfolge, zwei Spalten, 50 × 50 große Farbfelder mit 8 Pixel Abstand; `miro-note-palette.png`, `local-note-palette.png` |
| Formen / Linien | Rechteck, Oval, Raute, Dreieck sowie angebotene Linienarten; `*-scene-shapes.png` |
| Einzelauswahl | Auswahlrahmen, Eckgriffe, Kontextleiste und deren Abstand zur Auswahl; `*-scene-selected.png` |
| Mehrfachauswahl | Shift-Auswahl, gemeinsamer Rahmen, Einzelmarkierungen, Objektzähler; `*-scene-multiple.png` |
| Textbearbeitung | Sofortige Eingabe, Doppelklick, Ersetzen, Escape, Absatz und automatischer Umbruch; `*-scene-editing.png` |
| Objekteinstellungen | Füllfarbe, Schriftgröße, Stil/Ausrichtung, Notizgrößenmenü; `*-scene-fill.png`, `miro-note-settings.png`, `miro-note-size-m.png`, `miro-align-menu.png` |
| Rechtsklick | Tatsächlich angebotenes Referenzmenü und lokal implementierte Teilmenge; `*-scene-rightclick.png` |
| Zoom / Navigation | Prozentmenü, 100 → 125 → 100 %, Hand, Leertaste/Pan, Raster; `*-scene-zoom.png`, `miro-zoom-125.png`, `miro-gesture-pan.png` |
| Weitere Dialoge | Lokale Bedienhilfe und Importfehler; `local-help-dialog.png`, Zusatzprüfungen |

Zugängliche DOM-Strukturen, Rollen und berechnete CSS-Werte wurden direkt über Playwright untersucht. Referenzwerte: normale Werkzeugbuttons transparent, aktiver Hintergrund `rgb(238,238,235)`, Hover `rgb(244,244,241)`, Cursor `pointer`, Radius 12 px. Die gemessene Referenz-Kontextleiste war 48 px hoch, mit Radius 16 px und einem dezenten zweistufigen Schatten. Die Form-Schriftgrößenauswahl zeigte 14; Notiz S hatte etwa 100 × 100, die explizit ausprobierte Größe M etwa 200 × 200 sichtbare Pixel bei 100 %.

Miro-Objekte wurden als Canvas-Inhalte behandelt; aus dem Fehlen von Objekt-DOM wurde keine CSS-Geometrie abgeleitet. Für Drag/Pan wurden zusätzliche Vorher-/Nachherbilder erstellt. Die gelbe Vergleichsnotiz bewegte sich beim Referenz-Drag sichtbar um (+40,+40); nach Zoom und Pan war ebenfalls eine gemeinsame Ansichtsbewegung erkennbar. Wegen der Zoom-/Ansichtsanpassung wird aus diesen Bildern kein allgemeiner Miro-Pan-Faktor behauptet. Cmd+D und anschließendes Undo wurden auf einer Testnotiz beobachtet. Die Testansicht wurde durch Gegenbewegung wieder zurückgeführt; die Vergleichsgalerie verwendet die zuvor aufgenommenen Ansichten.

Ein Auslesen ausgelieferten Miro-JavaScripts oder privater Netzwerkantworten war für die umgesetzten Korrekturen nicht erforderlich. Keine Miro-Quellcodedateien, Markenlogos oder geschützten Assets wurden übernommen. Die lokale Darstellung verwendet eigenes HTML/SVG/CSS und die installierten Lucide-Icons. Es gibt keine Verbindung zu privaten Miro-Endpunkten; Cookies, Tokens und Authorization-Header wurden nicht exportiert.

## Priorisierte Abweichungen und umgesetzte Korrekturen

| Priorität | Festgestelltes Problem | Korrektur / Prüfung |
| --- | --- | --- |
| P0 | Neue Notizen verloren beim Anlegen den Editorfokus; unmittelbar eingegebener Text blieb leer. | Platzierung/Editoröffnung auf `pointerup`, kontrollierter Fokus. A01 und Speicherung laufender Eingabe bestanden. |
| P0 | Doppelklick erreichte wegen Pointer Capture teilweise die SVG-Fläche statt des Objekts. | Zusätzliche koordinatenbasierte Objekterkennung. A02/A03/A05 sowie Text-Undo/Redo bestanden. |
| P1 | Die Kontextleiste konnte nach einem Werkzeugwechsel die nächste Zeichenaktion abfangen. | Wechsel zu einem Zeichenwerkzeug beendet die Auswahl; A03 und erneute komplette Abnahme bestanden. |
| P1 | Verbindungen zusätzlicher Dreiecke hätten am unsichtbaren Rand des umschließenden Rechtecks geendet. | Seitliche Dreieckanker liegen auf der sichtbaren schrägen Kante und folgen Bewegung/Skalierung; Modell- und Browserprüfung bestanden. |
| P2 | Breiter Seitenkopf, große Leerzustandswerbung, Punktraster und großzügige Abstände wichen stark ab. | Kompakte schwebende 48-px-Leisten, dezentes Linienraster, reduzierte Einstiegsschaltfläche, Werkzeuggröße/Abstände/Radien/Schatten angeglichen. Eigener Name bleibt. |
| P2 | Acht andere Notizfarben statt der beobachteten Palette. | 16 gemessene Farbtöne mit zwei Spalten und gleicher Reihenfolge; Palette und Füllfarbänderung bestanden. |
| P2 | Notizen entstanden oben links am Klickpunkt; Text war breiter/größer als beobachtet. | Notizen entstehen annähernd mittig; schmaler freier Text mit 14 px, automatische Notizschrift und passende Umbrüche. Freie Texte wachsen während der Eingabe bei längeren Inhalten in der Höhe. |
| P2 | Kontextleiste war fest oben mittig; Auswahl und Verbinder waren grün. | Leiste folgt der Auswahl und bleibt auch während der Texteingabe sichtbar, wird seitlich im Viewport gehalten; blaue Rahmen/Griffe und Einzelmarkierungen bei Mehrfachauswahl. |
| P2 | Vorhandene Einstellungen waren sehr eingeschränkt. | Funktionierende Typ-/Schriftgrößenwahl, Vergrößern/Verkleinern, Fett/Kursiv, horizontale/vertikale Ausrichtung, S/M/L, Füllfarben und Kontrast auf Schwarz. |
| P2 | Kein lokales Rechtsklick- oder Zoommenü. | Duplizieren, Löschen, Inhalte leeren, Vorder-/Hintergrund; Zoomvorgaben, Fit-to-content und Rasterumschaltung. Nur tatsächlich umgesetzte Aktionen werden angezeigt. |
| P2 | Linien nur als ein Pfeiltyp. | Gerade, gebogene und gewinkelte Linien, Pfeilspitze ein/aus, Linienfarbe; Bindungen bleiben erhalten. |

Alle Erweiterungen wurden eigenständig implementiert. Dokumentmodell und Validierung liegen in `lib/document.ts`, Darstellungswerte in `lib/presentation.ts`, Verlauf/Persistenz in `lib/useDocument.ts`, die SVG-Ausgabe in `BoardScene.tsx` und die Objekteinstellungen in `SelectionToolbar.tsx`. Browser-APIs bleiben auf der Clientseite.

## Abnahme A01–A16 nach der Korrektur

| ID | Ergebnis | Geprüfte Erwartung |
| --- | --- | --- |
| A01 | Bestanden | Eine hellgelbe Notiz, unmittelbare Texteingabe, zentrierter Text |
| A02 | Bestanden | Ersetzen und Verschieben ohne Textverlust |
| A03 | Bestanden | Aufgezogenes 200 × 120-Rechteck, mittige Beschriftung |
| A04 | Bestanden | Eigenständiger mehrzeiliger Text |
| A05 | Bestanden | Ersetzen ohne zusätzliches Textobjekt |
| A06 | Bestanden | Sichtbarer Pfeil von Notiz zu Form |
| A07 | Bestanden | Verbindung folgt verschobenem Rechteck |
| A08 | Bestanden | Skalierung über Eckgriff, Text und Randanker bleiben korrekt |
| A09 | Bestanden | Rahmenauswahl von Notiz, Verbindung und Form; Text ausgeschlossen |
| A10 | Bestanden | Gemeinsame Bewegung, relative Abstände, Text bleibt stehen |
| A11 | Bestanden | Gemeinsame Löschung; freier Text bleibt |
| A12 | Bestanden | Gemeinsames Undo, Redo und erneutes Undo mit Positionsprüfung |
| A13 | Bestanden | Zwei Objekte per Shift ausgewählt |
| A14 | Bestanden | 100 → 125 → 100 %, sichtbare Größe folgt |
| A15 | Bestanden | Leertaste/Pan verschiebt Inhalte, feste Leisten und Zoom bleiben |
| A16 | Bestanden | Auswahlrahmen erscheint und verschwindet |

Zusätzlich bestätigt: S/M/L, Formatierung/Ausrichtung, schwarze Notiz mit weißer Schrift, Typwechsel und Dreieckzeichnen, Rechtsklickduplikation und Cmd/Strg+D, Zoomvorgaben/Raster, Hilfe, lokales Wiederherstellen, Speichern vor Escape, Text-Undo/Redo, Exportdownload mit validiertem JSON-Inhalt, Import samt Undo/Redo, ungültiger Import ohne Datenverlust, Linientypen/Pfeilspitze, Textwachstum/Sonderzeichen, Dreieckverbindung und Hand/Mausradzoom.

## Verbleibende Unterschiede und Grenzen

- **Kein pixelidentischer Nachbau:** eigene Marke, Arial/Systemschrift statt Miro-Noto-Sans, Lucide statt Miro-Icons, vereinfachte Notizpapierdarstellung und Pfeilspitzen; geringe Textmetrik-/Anker-/Auswahlabstände unterscheiden sich. Die lokale Werkzeugleiste ist kürzer, da nicht umgesetzte Werkzeuge fehlen.
- Die Kontext- und Rechtsklickmenüs enthalten die funktionierende lokale Teilmenge. Kein Miro-Blockmodus, keine dauerhaften Gruppen, Rotation, Sperren, Kommentare, Frames, Vorlagen, Tags/Emojis, Links, Übersetzung oder KI-Funktionen. Keine funktionslosen Schaltflächen dafür.
- Schriftformatierung gilt für ganze Objekte, nicht für beliebige Teilbereiche eines Rich-Text-Inhalts. Die Editorzentrierung basiert bei umgebrochenen Zeilen auf einer Näherung. Größe L wird lokal mit 400 × 400 abgebildet; sie wurde in Miro nicht separat vermessen.
- Linienendpunkte lassen sich noch nicht manuell umhängen. Randseiten bleiben beim Verschieben fest; kein vollständiges automatisches Hindernisrouting, keine Linienbeschriftung. Beim Löschen eines Endobjekts werden dessen Verbindungen mitgelöscht.
- Zoom lokal auf 20–400 % begrenzt; kein Miro-Vollbild-/Minimap-Umfang. Ansichten und Verlauf werden nach Neuladen zurückgesetzt. Desktop/Maus/Tastatur geprüft; Touchgesten und umfassende Tastaturnavigation einzelner Objekte bleiben offen.
- Lokales Speichern ist browser- und ursprungsgebunden, ohne tabübergreifende Synchronisierung. Keine Serverpersistenz, Anmeldung oder Zusammenarbeit; Undo hält bis zu 100 Aktionen im Arbeitsspeicher. JSON-Export bleibt die separate Sicherung.
- Der benutzerseitig laufende Server ermöglichte diese Sitzung, ohne dass ein eigener Serverprozess gestartet werden musste. Eine neue Serverinstanz oder ein eigener CLI-Chromium-Start aus der Shell wurde nicht als erfolgreich behauptet. Für den Livevergleich bestanden keine verbleibenden MCP-Blockaden.

---

## Historischer Prüfstand der ersten Umsetzung

Der folgende Abschnitt bleibt als Dokumentation der früheren, damals blockierten Abnahme erhalten. Für den aktuellen Stand gelten die Ergebnisse oben.


Stand: 29.10.2026. Grundlage: `miro-behavior.md` und alle 13 zugehörigen Screenshots, als Kontaktübersicht betrachtet. Die Dokumentation und Bilder wurden bei der Umsetzung nicht verändert.

### Implementiert

Notizen mit acht Farben, Rechteck/Oval/Raute, bearbeitbare mehrzeilige Texte, Einzel- und Mehrfachauswahl, Auswahlrahmen, gemeinsame Bewegung, Skalierung über vier Eckgriffe, Löschen, gebundene gekrümmte Pfeile, freie Pfeilendpunkte, Zoom/Pan, Undo/Redo, automatisches lokales Speichern/Wiederherstellen. Zusätzlich JSON-Import/Export, Boardname, Farbänderung ausgewählter Objekte und eine Bedienhilfe. SVG und HTML-Textdarstellung bilden die Grundlage; es besteht keine Abhängigkeit von einem proprietären Whiteboard-SDK.

### Erfolgreiche technische Prüfungen

- `npm run build`: Next.js-Produktionsbuild erfolgreich, einschließlich TypeScript-Prüfung und statischer Seitengenerierung.
- `npx --no-install tsc --noEmit`: erfolgreich.
- `npm run test:model`: sechs Tests bestanden. Prüfen Randanker nach Bewegung/Skalierung, Anheften/freie Endpunkte, Auswahlgeometrie, relative Positionen bei gemeinsamer Bewegung, JSON-Rundlauf und Ablehnung defekter Importdaten.
- Alle 13 PNG-Kopien gegen Originale unter `/Users/erikivanov/docs/miro-evidence/` geprüft; Dokumentation entspricht dem Original bis auf die bereits angepassten Bildpfade.

### Browserabnahme: blockiert, nicht bestanden gemeldet

`tests/acceptance.spec.ts` enthält die 16 Abnahmen als einzelne Playwright-Tests in der dokumentierten Reihenfolge. Die folgenden Erwartungen sind implementiert, aber **noch nicht im Browser bestätigt**:

| Test | Prüfgegenstand | Ergebnis |
| --- | --- | --- |
| A01 | Hellgelbe Notiz, Text und Zentrierung | Blockiert vor Browserstart |
| A02 | Notiztext ersetzen und Objekt bewegen | Nicht ausgeführt |
| A03 | Rechteck aufziehen und beschriften | Nicht ausgeführt |
| A04 | Mehrzeiliger freier Text | Nicht ausgeführt |
| A05 | Text ersetzen ohne Duplikat | Nicht ausgeführt |
| A06 | Gebundener Pfeil | Nicht ausgeführt |
| A07 | Pfeil folgt bewegtem Rechteck | Nicht ausgeführt |
| A08 | Skalierung und Randanker | Nicht ausgeführt |
| A09 | Rahmenauswahl von drei Elementen | Nicht ausgeführt |
| A10 | Gemeinsame Bewegung | Nicht ausgeführt |
| A11 | Gemeinsame Löschung | Nicht ausgeführt |
| A12 | Undo/Redo der gemeinsamen Löschung | Nicht ausgeführt |
| A13 | Shift-Auswahl von zwei Objekten | Nicht ausgeführt |
| A14 | Zoom 100 → 125 → 100 % | Nicht ausgeführt |
| A15 | Leertaste/Pan und feste Werkzeugleisten | Nicht ausgeführt |
| A16 | Auswahl sichtbar und aufgehoben | Nicht ausgeführt |

Sieben Zusatzprüfungen decken Wiederherstellung nach Neuladen, Speicherung vor Escape, Undo/Redo von Text, JSON-Import/Export, ungültige Importe, Oval/Raute und Browserfehler/Sonderzeichen ab. Sechs waren beim ersten Lauf vorhanden, die Prüfung der laufenden Texteingabe wurde danach ergänzt.

Der tatsächlich gestartete erste Playwright-Lauf meldete 7 fehlgeschlagene Tests und 15 übersprungene Tests: Alle sieben Fehler entstanden beim Starten des Browsers, bevor eine Seite oder Testaktion ausgeführt wurde. Dies sind keine beobachteten Produktfehler und kein Nachweis funktionierender Browserinteraktionen.

Blockaden:

1. `npm run dev`: `listen EPERM: operation not permitted 0.0.0.0:3000`. Die Sandbox erlaubt keinen lokalen Serverport.
2. Playwright-MCP: `Browser is already in use for .../miro-chromium-profile`. Die bestehende Miro-Instanz und deren Profil wurden nicht beendet oder verändert.
3. Eigenes Chromium über Playwright-CLI: macOS `bootstrap_check_in ... Permission denied` sowie `Crashpad/settings.dat: Operation not permitted`. Der Browser wurde vor dem Laden der Anwendung beendet.

Der Produktionsbuild wurde deshalb zusätzlich für einen Testmodus ohne Server vorbereitet: `WHITEBOARD_STATIC_TEST=1 npm test`. Dabei beantwortet Playwright die App- und Assetanfragen mit den echten Next.js-Builddateien. Auch dieser Modus scheiterte am Browserstart. Eine visuelle Abnahme der fertigen Anwendung ist daher offen.

Zum Fortsetzen müssen die Ausführungsrechte lokale Server und Browserstarts zulassen oder der Playwright-MCP-Server ein freies/isoliertes Browserprofil erhalten. Dann `npm test` erneut ausführen, Fehler beheben und dieses Protokoll aktualisieren. Die vorgesehene lokale URL ist `http://localhost:3000`; derzeit läuft dort aus dieser Umsetzung kein Server.

### Bewusste Abweichungen

Eigener Name und eigene Gestaltung; acht statt 16 Notizfarben; zusätzliche Formen Oval/Raute, kein Dreieck. Notizposition entspricht beim Anlegen der oberen linken Ecke. Auswahlrahmen müssen Objekte vollständig enthalten. Verbindungen nutzen feste Randseiten mit dynamischer Randmitte; deren Enden lassen sich noch nicht manuell umhängen. Das Löschen eines Endobjekts entfernt seine Verbindungen im selben Undo-Schritt. Escape beendet den Texteditor und lässt die Objektauswahl bestehen; außerhalb des Editors hebt Escape die Auswahl auf.

Freier Text beginnt mit 180 × 80 Einheiten; große Inhalte benötigen manuelle Größenänderung. Kein automatisches Textfeldwachstum, keine vollständige Typografieparität, keine dauerhaften Gruppen/Rotation/Sperren. Ansicht und Undo-Verlauf werden nicht über Neuladen erhalten. Kein Mehrbenutzerbetrieb und keine tabübergreifende Synchronisierung. Weitere Grenzen und Startbefehle stehen in `README.md`.
