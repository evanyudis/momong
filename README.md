# BumpBuddy PWA

Free MVP: pregnancy tools (HPL, contraction timer + pattern, kick counter, symptoms, hospital bag, monthly report, theme), a thin newborn mode (bottle, ASI, pump, diaper), and optional sync with a partner (2 seats, both can write). Local-first: everything works offline without an account.

- Stack: Vite + React + TypeScript, plain CSS tokens from `DESIGN-TOKENS.md`.
- Data: `localStorage`, every record syncs by id with last-write-wins on `updatedAt` and tombstone deletes.
- API: [`momong-api`](https://github.com/evanyudis/momong-api) (private). The client only knows the public base URL.

```sh
cp .env.example .env.local   # VITE_API_URL=http://localhost:8787 to test sync locally
npm i
npm run dev
npm test
npm run build
```

Deploy on Vercel as a Vite project (build `npm run build`, output `dist`), env `VITE_API_URL=https://<api>.fly.dev`.
