# Production readiness gate

Feature planning preceded implementation in PLUS-IMPLEMENTATION.md. All planned Plus features now use confirmed sandbox entitlement. Live checkout is still refused by the API; Evan has not authorized enabling real payments.

## Verified locally — 5 October 2026

- Client: 35 tests and production build pass. API: 11 tests and build pass. Dependency audits report no vulnerabilities.
- Optional login, guest setup in both modes, existing setup, mobile light/dark, reduced motion, login without automatic upload, sync consent, merge/tombstones and logout during requests were checked.
- Lifetime checkout/order ownership and signed webhook grant/replay rules use a mocked Midtrans sandbox provider in API tests. A real hosted sandbox transaction is still required on the deployed backend.
- Profile isolation/legacy records/downgrade preservation, full history after upgrade, actual chart totals, estimate boundaries, reminder repeat prevention, wishlist claim races/revocation and safe public payloads have runnable tests.
- A paginated PDF was visually checked. Production PWA reload and PDF export succeeded offline with synthetic local records. No health data was uploaded by export.

## Required before production payment wiring

1. Deploy API code, apply additive wishlist schema migration, verify database health and backup/restore procedure. The running VPS currently serves an older build. Obtain the SSH destination and app directory from Evan; reuse existing server secrets without printing them.
2. Verify sandbox merchant configuration, hosted redirect/return, actual successful and pending transactions, cancel/expiry/failure, signed duplicate webhook delivery and delayed webhook recovery. Never expose server keys to the client.
3. Confirm public HTTPS webhook reachability and authenticated API forwarding. Current Vercel-to-VPS hop is HTTP; plan TLS on the API origin before production.
4. Define payment support/refund/reconciliation procedures, privacy copy and entitlement revocation policy. Device-cached entitlement allows offline use until the next online session validation; define a different validity policy only if required.
5. Confirm product limitations: reminders require an open app, wishlist links expire after seven days, and disconnected Free PDF quota is best effort. Plan reliable background reminders separately if required.
6. Decide monthly/recurring and trial behavior separately, including renewals, cancellation and expiry. Neither is offered by this checkout.
7. Request Evan's explicit approval only after the above is verified. Then plan the smallest live Midtrans wiring change, production configuration, monitoring and rollback. Keep sandbox and live credentials isolated.

Frontend push/deployment is available through the existing Vercel integration. End-to-end sandbox verification remains blocked by the old API deployment and unverified merchant configuration; green mocked tests do not resolve those blockers.
