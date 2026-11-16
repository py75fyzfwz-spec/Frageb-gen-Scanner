# Fragebögen auswerten

Web-App, die eingescannte Papier-Fragebögen des *Europäischen Filmfestivals der Generationen* mit Claude (Anthropic) liest und eine Excel-Datei im Format der Eingabetabelle (`filmfest2026_dateneingabe.xlsx`) erzeugt.

## So funktioniert es

1. **Scans auswählen**: PDF (auch mehrseitig) oder JPG/PNG. Jede Seite ist ein Bogen.
2. **Hochladen**: Der Browser verkleinert jede Seite und legt sie bei Anthropic ab (Files API, automatisches Löschen nach 7 Tagen).
3. **Auswerten**
   - *Sofort*: jede Seite einzeln, für Tests und kleine Mengen.
   - *Sammelauftrag*: alle Seiten auf einmal über die Message Batches API. Halber Preis, meist unter einer Stunde fertig, das Fenster darf geschlossen werden.
4. **Excel herunterladen**: Spalten A bis Q entsprechen genau der Eingabetabelle (`ID, ver26, ort26, typ, datum, titel, novize, freq, film, talk, veranst, fest, wieder, nwieder, age, sex, notiz`). Dahinter stehen Datei, Seite, Prüfen und Hinweis. Unsichere Felder sind **gelb** markiert und zusätzlich im Blatt „Zu prüfen“ aufgelistet.
5. **Aufräumen**: Bilder bei Anthropic sofort löschen.

Die Veranstaltungsdaten (ver26, ort26, typ, datum, titel) kommen aus dem Codebuch (`data/codebuch.json`, erzeugt aus `codebuch2026.xlsx`). Die App liest den gedruckten Kopf jedes Bogens (Veranstaltungsort, Datum, Film) und sucht die passende Veranstaltung. Passt etwas nicht eindeutig, wird es gelb markiert. Man kann die Veranstaltung auch für einen ganzen Stapel fest auswählen.

Kodierung wie in der Eingabetabelle: novize 1 = Ja / 0 = Nein, freq = 1 bei Erstbesuch, Noten 1 bis 6, wieder 1 = Ja / 0 = Nein, sex 1 = Mann / 2 = Frau.

Der Fortschritt eines Auftrags wird im Browser gespeichert. Nach einem Neuladen geht es weiter; für noch nicht hochgeladene Seiten müssen die Dateien noch einmal ausgewählt werden (bereits hochgeladene werden übersprungen).

## Auf Vercel bereitstellen

1. Auf [vercel.com](https://vercel.com) mit GitHub anmelden, **Add New → Project**, dieses Repository importieren. Framework „Next.js“ wird erkannt, sonst nichts einstellen.
2. Unter **Environment Variables** eintragen:
   - `ANTHROPIC_API_KEY`: Schlüssel aus der [Anthropic Console](https://console.anthropic.com/settings/keys). Dort auch ein Ausgabenlimit setzen.
   - `APP_PASSWORD`: ein Passwort für die Anmeldung. Ohne Passwort startet die App absichtlich nicht.
3. **Deploy**. Die Adresse (z. B. `https://fragebogen-app.vercel.app`) und das Passwort weitergeben.

Der Schlüssel liegt nur auf dem Server und ist im Browser nie sichtbar.

## Kosten (Schätzung)

Modell `claude-opus-5-5` ($4 / $20 pro Million Token Ein-/Ausgabe). Pro Seite etwa 3.000 Token Bild plus 1.000 Token Anleitung, dazu die Antwort.

- Sofort: ca. 2 Cent pro Seite (Test mit 113 Brühl-Bögen: 2 Euro)
- Sammelauftrag: ca. 1 Cent pro Seite, also etwa 40 Euro für 4.000 Bögen

Die echten Kosten stehen in der Anthropic Console unter *Usage*. Am besten zuerst 20 bis 50 Bögen *sofort* auswerten und mit der Hand-Erfassung vergleichen.

Einstellbar über Umgebungsvariablen: `CLAUDE_MODEL` (z. B. `claude-sonnet-5-5`, günstiger) und `CLAUDE_EFFORT` (`low` Standard, `medium`/`high` gründlicher und teurer).

## Lokal entwickeln

```bash
npm install
cp .env.example .env.local   # Werte eintragen
npm run dev                  # http://localhost:3000
```

Ohne API-Schlüssel: `MOCK_CLAUDE=1` in `.env.local` liefert erfundene Antworten.

Neues Codebuch (z. B. für 2027): `npm run codebuch -- pfad/zum/codebuch.xlsx`, oder in der App unter „Codebuch“ die Datei laden. Die Spaltennamen müssen wie 2026 sein (`ver26`/`ver27`, Stadt, `ort26`/`ort27`, Raum, typ, titel, Filmtitel, datum).

## Wo was steht

| Datei | Inhalt |
|---|---|
| `lib/fragebogen.ts` | Was Claude lesen soll: Anleitung (Prompt) und Antwortformat |
| `lib/zeilen.ts` | Umrechnung in die Codes der Eingabetabelle, Regeln für „prüfen“ |
| `lib/zuordnung.ts` | Zuordnung des Bogenkopfs zum Codebuch |
| `lib/excel.ts` | Aufbau der Excel-Datei |
| `lib/claude.ts` | Aufruf der Claude API (Modell, Einstellungen) |
| `app/page.tsx` | Die Oberfläche |
| `app/api/*` | Server-Routen: Hochladen, Auswerten, Sammelauftrag, Löschen, Anmeldung |
