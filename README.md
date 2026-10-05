# BumpBuddy PWA

Free MVP: pregnancy tools, thin newborn mode, local-first records in localStorage. The initial sign-in screen offers “Lanjut tanpa akun”; completed setup opens directly offline. Login is required for Plus checkout and optional cloud/partner sync. Signing in does not enable sync: opt in on Sinkron & pasangan. Logout keeps device records and pending changes.

Plus: hosted Midtrans sandbox checkout for Selamanya and server-confirmed payment status. Real payments are disabled. Plus feature implementation follows the staged plan; no trial is granted by UI labels.

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
