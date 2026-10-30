# Whiteboard

> Ein kollaboratives Whiteboard, entwickelt als **AI Vibe Coding Projekt**.

Whiteboard ist eine moderne Canvas-Anwendung für Ideen, Zusammenhänge und gemeinsame Arbeit. Das Projekt wurde mit AI-Unterstützung entwickelt: AI war Teil des Coding- und Designprozesses, ist aber **nicht in die Anwendung integriert**. Es gibt aktuell keine AI-API, keinen AI-Chat und keine automatische Inhaltsanalyse.

## Was ist enthalten?

### Whiteboard-Editor

- Notizen mit 16 Farben sowie Rechtecke, Ovale, Rauten und Dreiecke
- Freier Text mit automatischer Schriftanpassung
- Gerade, gebogene und gewinkelte Verbindungen mit Pfeilspitzen
- Verbindungen zu Objekten mit automatischen Anschlussseiten und Hindernisumgehung
- Mehrere Beschriftungen direkt auf einer Verbindung
- Auswahlrahmen, Multi-Select, Verschieben, Skalieren, Duplizieren und Ebenensteuerung
- Undo/Redo, Tastaturkürzel, Zoom von 20–400 % und Fit-to-content
- JSON-Export und validierter JSON-Import

### Zusammenarbeit und Boards

- Gemeinsame Boards über sichere Freigabelinks
- Gastrechte getrennt nach **Ansehen** und **Bearbeiten**
- Live-Synchronisierung, Anwesenheits-Avatare und farbige Gastzeiger
- Automatischer Reconnect bei Verbindungsabbrüchen
- GitHub-Login für private Boards und persönliche Boardübersicht
- Suche, Sortierung, Favoriten sowie Kachel- und Listenansicht

## AI Vibe Coding

Dieses Repository dokumentiert einen AI-gestützten Entwicklungsprozess: Ideen, UI-Entscheidungen, Implementierung, Tests und Refactoring wurden iterativ mit AI-Unterstützung umgesetzt. Das Ergebnis ist ein echtes Whiteboard-Projekt — aber **kein AI-Produkt im technischen Sinne**.

### Aktueller Stand

- Keine Verbindung zu OpenAI, Anthropic oder einem anderen AI-Anbieter
- Keine API-Keys für AI erforderlich
- Keine Boarddaten werden an AI-Dienste übertragen
- AI-Funktionen wie Copilot, Clustering oder Zusammenfassungen sind mögliche zukünftige Erweiterungen, aber nicht Bestandteil der aktuellen Version

## Installation

Voraussetzungen:

- Node.js **20.9 oder neuer**
- npm
- Optional: eine GitHub OAuth App für private Boards

```bash
nvm use
npm ci
```

### Umgebungsvariablen einrichten

Lege im Projektverzeichnis eine `.env`-Datei an. Als Vorlage dient `.env.example`:

```bash
cp .env.example .env
```

Trage anschließend die Werte ein:

```dotenv
GITHUB_CLIENT_ID=deine-github-client-id
GITHUB_CLIENT_SECRET=dein-github-client-secret
APP_URL=http://localhost:3001
# Optional: mindestens 32 Bytes
# AUTH_SECRET=ein-langer-zufälliger-geheimer-schlüssel
```

Für die lokale GitHub OAuth App muss folgende Callback-URL hinterlegt sein:

```text
http://localhost:3001/api/auth/github/callback
```

Secrets dürfen niemals committed oder veröffentlicht werden. `.env` ist bereits in `.gitignore` enthalten. Ohne GitHub OAuth können geteilte Gastlinks weiterhin genutzt werden.

### Anwendung starten

```bash
npm run dev -- --port 3001
```

Die Anwendung ist danach unter <http://localhost:3001> erreichbar.

## Tech-Stack

- **Next.js 16** mit App Router und TypeScript
- **React 19**
- **Canvas 2D** für die Board-Darstellung
- **Node.js API Routes** für Boards, Sharing und Authentifizierung
- **Dateibasierte Persistenz** für den aktuellen Single-Server-Betrieb
- **Playwright** und Node Model Tests

## Projektstruktur

```text
app/                 Seiten, Layout und API-Routen
components/          Dashboard, Login, Whiteboard, Canvas und Toolbars
lib/document.ts      Versioniertes Dokumentmodell und Validierung
lib/interactions.ts  Geometrie, Auswahl und Verbindungslogik
lib/collaboration.ts Synchronisierung und Anwesenheit
lib/useDocument.ts   Verlauf und lokale Persistenz
tests/               Modell- und Browser-Tests
docs/                Prüfstände, Vergleichsbilder und technische Notizen
```

Das Dokumentmodell trennt Boarddaten vom UI-Zustand. Dadurch bleibt die Anwendung erweiterbar, ohne bereits eine AI-Integration vorauszusetzen.

## Tests und Build

```bash
npm run build
npm run test:model
npm test
```

Für einen bereits laufenden lokalen Server:

```bash
WHITEBOARD_BASE_URL=http://localhost:3001 npm test
```

## Deployment

Der aktuelle Server benötigt persistenten Speicher für `.data/boards/` und `.data/auth/` und ist für einen einzelnen Node-Prozess ausgelegt. Für mehrere Instanzen sollten die Dateispeicherung und Realtime-Synchronisierung später durch gemeinsame Infrastruktur ersetzt werden.

Für eine öffentliche Bereitstellung müssen `APP_URL`, die GitHub-Callback-URL und HTTPS korrekt konfiguriert werden. `localhost` ist nur auf dem eigenen Gerät erreichbar.

## Mögliche nächste Schritte

- AI-gestützte Board-Zusammenfassungen
- Semantische Suche und Clustering
- Erzeugung von Board-Strukturen aus Textbeschreibungen
- Aufgaben- und Entscheidungs-Extraktion
- Datenbankadapter für skalierbare Deployments
- Verbesserte Touch- und Accessibility-Unterstützung

Die genannten AI-Funktionen sind Ideen für die Zukunft und aktuell nicht implementiert.

## Lizenz

Dieses Projekt steht unter der [MIT-Lizenz](LICENSE). Sie erlaubt die private und kommerzielle Nutzung, Bearbeitung und Weitergabe des Projekts, solange der Lizenz- und Copyright-Hinweis erhalten bleibt.
