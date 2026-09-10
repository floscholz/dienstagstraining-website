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

Draft-Deploy:

```sh
npx netlify-cli@latest deploy
```

Production-Deploy:

```sh
npx netlify-cli@latest deploy --prod
```

Ein reiner `dist`-Upload enthält die Function nicht. Für Netlify-Builds müssen `LEGAL_NAME`, `LEGAL_STREET`, `LEGAL_CITY`, `LEGAL_COUNTRY` und `LEGAL_EMAIL` als Build-Environment hinterlegt sein.
