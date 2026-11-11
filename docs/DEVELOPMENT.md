# Entwicklung

## Setup

Voraussetzungen: Node.js (siehe `package.json`, aktuell `>=22.12.0`) und npm.

```sh
npm install
cp .env.example .env
```

Die Datei `.env` enthält lokale Betreiberwerte für Impressum und Datenschutz und wird nicht versioniert.

## Scripts

```sh
npm run dev
npm run build
npm run preview
```

`npm run dev` startet den Astro-Entwicklungsserver. `npm run build` erzeugt den statischen Output in `dist`.

## Netlify Function lokal testen

Für Redirects und die Nuudel Function muss Netlify Dev laufen:

```sh
npx netlify-cli@latest dev
curl -i "http://localhost:8888/api/nuudel"
```

Falls Netlify Dev einen anderen Port meldet, ist dieser Port für den `curl`-Aufruf zu verwenden.

## Deployment

### Einmalige lokale Einrichtung

```sh
cp .env.deploy.example .env.deploy
```

Anschließend das FTP-Passwort ausschließlich lokal in `.env.deploy` eintragen. Die Datei wird von Git ignoriert. Die bestehende Netlify-Site muss lokal verknüpft sein und die Netlify CLI muss authentifiziert sein.

### Validieren und veröffentlichen

```sh
npm run deploy:check
npm run deploy:all
```

`deploy:check` prüft Konfiguration und Programme, führt Tests und Build aus und validiert `dist/`, ohne eine Netzwerkverbindung oder Veröffentlichung zu starten.

`deploy:all` führt Tests und Build aus, veröffentlicht danach `dist/` samt `netlify/functions/` auf der bereits verknüpften Netlify-Production-Site und lädt nur bei erfolgreichem Netlify-Deploy denselben `dist/`-Stand auf den FTP-Webspace. Der FTP-Upload überschreibt gleichnamige Dateien und ergänzt neue Dateien, löscht aber keine fremden oder alten Dateien.

Der alte FTP-Webspace unterstützt technisch nur unverschlüsseltes FTP. Zugangsdaten dürfen deshalb nie in Git, Scripts oder Logs übernommen werden.

Für Netlify-Builds müssen `LEGAL_NAME`, `LEGAL_STREET`, `LEGAL_CITY`, `LEGAL_COUNTRY` und `LEGAL_EMAIL` als Build-Environment hinterlegt sein.
