# Plus implementation and production gate

Approved sequence: optional login/offline Free + sandbox paywall → this feature plan → feature implementation with sandbox entitlement → production readiness plan → explicit Evan approval before live payments.

## Decisions

- Household entitlement from /me is authoritative online. Cache confirmed entitlement for offline use on the signed-in device; clear it on logout/401. No local upgrade switch. Free sync/partner stay free and separately opted in.
- Implement in order: shared entitlement + history, multiple baby profiles, PDF, trends and next-feed estimate, user-set reminders, wishlist sharing/claiming. Keep the existing store, routes, CSS and merge/tombstone protocol.
- History: Free hides ASI/pump/diaper older than 30 days; Plus sees all stored records. Never delete on downgrade. Upgrade resets the pull cursor so previously hidden history is fetched.
- Baby profiles: preserve existing untagged records as default baby. Tag new baby-scoped logs/checklist/wishlist with babyId; device-only selected baby. Existing settings/main remains the default profile, additional profiles use baby records. Free sees the default baby, Plus can add/switch profiles. Server refuses writes to additional profiles on Free.
- PDF: jsPDF (MIT, https://github.com/parallax/jsPDF), generated on device from selected profile. Direct downloadable paginated PDF, no print-dialog dependency or uploads. Bundle lazily; precache the PDF module for installed offline PWA use. Free one successful export per calendar month, quota stored as shared report settings; Plus unlimited. Free offline quota is best effort across disconnected devices, matching local-first behavior.
- Trends: actual seven-day feeding count, pump volume, diaper count; accessible values accompanying SVG charts. Empty data has an empty state, never fabricated bars for Plus.
- Estimate: median positive start-to-start intervals from recent bottle/ASI records (seven days, latest 20 sessions); at least three sessions. Show “perkiraan”, sample count, and non-clinical disclaimer, no recommended feeding schedule.
- Reminders: user-set label and timestamp, device-local; enabled only for Plus. In-app checks on launch/visibility and while open, optional browser notifications with explicit permission. State clearly that reminders require the app to be open; reliable closed-app push needs a later separately planned service. Never request permission on page load.
- Wishlist: Free local list remains. Plus signed-in users can explicitly share the selected baby's list online; payload includes item labels/claim state only, never pregnancy/feeding/account data. Use a random revocable capability URL, guest display-name claim, conditional DB update to prevent double claim, server entitlement checks. Revoke prevents subsequent access. Sharing sends only wishlist records and does not silently enable general cloud sync.
- Monthly/recurring and trial are deferred; no dormant UI or fake trial label. Existing sandbox lifetime entitlement exercises every Plus feature.

## Acceptance

Test Free/Plus history and upgrade full-pull, profile isolation + legacy data, downgrade preservation, paginated PDF and quota, estimate sample boundaries, real chart totals, reminder duplicate prevention, guest claim races and revocation, sharing auth/entitlement, no sensitive data in shared response. Build/test both repos; mobile light/dark, keyboard/reduced motion, production PWA offline refresh/export. Use only synthetic data in verification.

## Production readiness (after features)

Confirm all benefits work, authenticated HTTPS API and webhook delivery, database backup/migrations, sandbox successful/pending/failure/replay cases, dependency audit, export integrity, privacy/consent and reminder limitations. Configure merchant production keys only after explicit Evan approval. Reconcile delayed notifications and payment support/refund handling before enabling live checkout. Current code must refuse production payments. Log any unavailable cloud configuration as blockers, never invent credentials.
