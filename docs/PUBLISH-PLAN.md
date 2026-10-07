# Momong publish plan — 6 October 2026

## Phase 1: public Free MVP

Live: https://momong.evanyudis.com . Existing https://momong.vercel.app remains supported. No additional domain purchase is needed.

Deployed frontend: dpl_Cva7omu1wYY9aYAPFbWpSUjwbWLA (READY). Frontend build explicitly sets VITE_PLUS_ENABLED=false. All Plus acquisition CTAs are disabled and say Segera hadir; the Plus page displays upcoming features without prices or checkout. Free logging, account sync, partner access, and the existing Free PDF allowance remain available.

API PLUS_ENABLED=false forces Free entitlement even when an account has a stored Plus plan. Lifetime and monthly checkout return 503 plus_coming_soon. Stored entitlements are preserved. Production Midtrans and both recurring methods remain disabled.

HTTPS: browser → Vercel HTTPS → Cloudflare HTTPS/tunnel → loopback API. The API listens on 127.0.0.1:8788. The legacy public port-80 redirect is disabled. TLS certificates are managed by Vercel/Cloudflare; no paid certificate is required. API hostname: momong-api.evanyudis.my.id.

Both application origins are trusted. The existing Better Auth Google callback base remains momong.vercel.app to preserve the registered OAuth redirect. Actual Google authorization and email delivery still require end-user verification; password signup/session and sync were verified against the public new domain.

Validation: 47 frontend tests and build pass; 17 API tests and build pass. Public synthetic signup/session, Free entitlement, sync, billing ownership, Plus restrictions and invalid webhook rejection pass; temporary records removed. Browser confirms disabled coming-soon Plus page. Tests exercise mocked payments, not a real production charge.

Origin migration: browser-local guest data does not automatically move from momong.vercel.app to momong.evanyudis.com. Export a backup from the old origin and restore on the new origin; authenticated users can use existing account sync.

## VPS reliability and launch limits

Observed: 2 vCPU, 1.9 GiB RAM, about 857 MiB available, 13 GiB disk free, 103 days uptime. Momong systemd service uses roughly 42 MB, has automatic restart and zero recorded restarts at inspection. These observations establish current health, not a reliability SLA.

Two unrelated processes each consumed about one CPU core during inspection. Leave those workloads untouched; isolate or reduce their load before wider promotion. Backup restoration, external uptime alerting, sustained load capacity, and recovery after a server outage are not verified. Publish initially to a small group; do not promise large-scale availability on this evidence.

## Phase 2: Plus payments

Keep Plus disabled until Midtrans Business Review is approved and production credentials/method activation are confirmed. General merchant approval alone does not prove recurring eligibility.

1. Confirm production lifetime and recurring method availability with Midtrans, prices, consent, cancellation, refund/support flow, and public legal/contact details.
2. Verify every Plus feature against real entitlement and household access; preserve Free behavior.
3. Run real authorized low-value production payment verification: lifetime settlement activates Plus exactly once; failed/pending payments do not grant access; duplicate/missed webhooks recover safely.
4. For recurring, verify initial payment/linking, provider subscription provisioning, renewal dates, renewal failure, cancellation before and after first payment, replay safety, and status recovery. Enable only methods approved and proven end to end.
5. Enable server PLUS_ENABLED and matching frontend flag together, with rollback and monitoring. Publish only the payment methods that passed verification.

Phase 2 remains pending merchant approval and real production verification.

## Phase 1 profile UI follow-up — 6 October 2026

- Plus badges retain the product label “Plus”; acquisition CTA remains disabled “Segera hadir”.
- Baby-profile selector and reminder entry are hidden while PLUS_ENABLED=false; return only when Phase 2 is ready and matching release flags are enabled.
- Guest sync card displays “Belum terhubung · catatan lokal” without a status dot, explains free online sync, and opens registration directly. Signed-in users see the existing actual sync status and an activation hint if sync is disabled.
- Theme control is a compact row with right-aligned Lucide Sun/Moon/Monitor icons, accessible labels and selected states.
- Redundant profile/settings shortcut removed from both Home modes; bottom Profile tab remains.
- 47 frontend tests, build and whitespace checks passed; live browser verified guest profile, registration link, compact theme layout and Home header. Payment flags remain disabled.


## Early access deployment — 6 October 2026

Frontend deployment `dpl_6jUL7Xg2w62Yq4Wm9Utqsu1SBRav` is READY on both momong.evanyudis.com and momong.vercel.app. Deployed from the working tree; no new commit. Build command explicitly sets VITE_PLUS_ENABLED=false. Public acquisition remains disabled “Segera hadir”; server-granted earlyAccess trials unlock Plus without enabling checkout.

Verified: both production origins serve the same JS asset as the local production build (`index-Ay-R5sbL.js`, SHA256 prefix `417ece7ab6a4d604`). A disposable account through the public origin was Free, received a CLI grant, returned trial/earlyAccess from /me, unlocked frontend entitlement and rendered trial status/feature links in SSR, and published a wishlist share. Both lifetime and monthly checkout returned 503. Revoking restored Free in frontend and API and blocked wishlist sharing. Synthetic account/household/grants/shares were removed. Live browser confirmed disabled public CTA. This does not claim every Plus feature was exercised in a live browser.

Admin guide: momong-api/docs/EARLY-ACCESS.md. Existing real accounts were not granted access by this deployment. Users should reopen the PWA online to receive the new release and entitlement.

## PostHog production — 7 October 2026

Frontend `dpl_3FvFsUoe4HRPLm7Wua6e1sTQTxqL` READY on both aliases, deployed from tested local static build with PostHog enabled and public Plus acquisition disabled. API telemetry deployed separately onto existing production source, preserving unrelated waitlist work. Health/DB checks pass; server SDK synthetic error ingest returns HTTP 200. Chrome renders primary domain; alternate domain profile toggle/navigation verified in the in-app browser.

Vercel production environment writes were denied 403 by connector and CLI. Current build contains public ingest configuration; project owner must persist the three VITE_POSTHOG variables before the next remote source build. Full evidence, limits and rollback: [POSTHOG.md](POSTHOG.md). No new commit.
