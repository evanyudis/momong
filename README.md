# Momong PWA

Free MVP: pregnancy tools, thin newborn mode, local-first records in localStorage. The initial sign-in screen offers “Lanjut tanpa akun”; completed setup opens directly offline. Login is required for Plus checkout and optional cloud/partner sync. Signing in does not enable sync: opt in on Sinkron & pasangan. Logout keeps device records and pending changes.

Plus: hosted Midtrans sandbox checkout for Selamanya and server-confirmed payment status. Confirmed entitlement opens multiple baby profiles, full history, seven-day charts, non-clinical next-feed estimates, user-set reminders, unlimited downloadable PDFs, and revocable wishlist sharing/guest claims. Real payments remain disabled.

Reminders run while the app is open; browser notifications require permission. PDFs are generated locally with jsPDF and a bundled OFL font; the installed PWA precaches the export module for offline use. Free exports once per calendar month; offline quotas across separate devices are best effort. Downgrading hides Plus history/profiles without deleting them. See [feature decisions](docs/PLUS-IMPLEMENTATION.md) and [production gate](docs/PRODUCTION-READINESS.md).

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

Deploy on Vercel as a Vite project (build `npm run build`, output `dist`). The current deployment proxies API routes to the VPS through `vercel.json`; local development can set `VITE_API_URL` to its local API.

## Analytics dan error tracking

Panduan konfigurasi PostHog, izin pengguna, dashboard, alert dan verifikasi: [docs/POSTHOG.md](docs/POSTHOG.md). Telemetry default nonaktif sampai project/key dikonfigurasi.
