# Momong market readiness — 6 October 2026 (Jakarta)

## Verdict

**NO-GO for public paid launch. Free functionality passes current checks, but broad public launch still needs HTTPS on the API origin and public privacy/support information.** The app is already reachable at https://momong.vercel.app; reachability is not launch approval.

Evan confirmed in this audit that Midtrans says **Activation in progress / Business review in progress**. Production payment-method activation is therefore unconfirmed. Do not switch to real keys, enable recurring methods, or advertise working real checkout while that review remains open.

## Verified in this audit

- Frontend: **46 tests passed**, production build passed.
- API: **16 tests passed**, TypeScript build passed; diff whitespace check passed.
- npm production dependency audit: **0 reported vulnerabilities** in both repositories. This is a dependency check, not a penetration test.
- Public API smoke test: synthetic password signup/session, Free entitlement, newborn settings sync, billing account read, private order ownership, Plus-only wishlist refusal, monthly method disabled, and forged webhook rejection passed. Synthetic accounts and records were removed.
- VPS service active; sandbox server key, email provider configuration and Google configuration present. Secret values were never printed. Presence does not prove email delivery or Google OAuth completion.
- Public `/billing/plans`: sandbox lifetime available; card and GoPay monthly unavailable. Both recurring activation flags are unset on the VPS.
- VPS billing source matched local source before edits. API origin listens on port 8788. Public `/health/db` has no Vercel rewrite and returns 404; origin database health passed directly on port 8788.
- Payment recovery fix deployed: authenticated order refresh now verifies Midtrans and fulfills lifetime or monthly payment, using the same workflow as webhook fulfillment. Tests cover missed webhook recovery, mismatch rejection, ownership and replay. Replay also retries lifetime-upgrade cancellation if the process stopped after granting.
- Deployment is a patch over the recorded release, not a new committed release. Code backup: `/opt/momong-api/release-backups/readiness-20261006/`. Source/build hashes verified after deployment; no migration, production key or recurring flag change.

## Integration map

| Connection | Implementation | Current verdict |
| --- | --- | --- |
| Plus plan picker → API | `src/screens/Plus.tsx`, `src/billing.tsx`; `/billing/plans`, `/billing/account` | Prices and method availability server driven; page explicitly sandbox |
| Lifetime initial payment | API `src/app.ts`; POST `/billing/lifetime` → Snap `/snap/v1/transactions` | IDR 199000, server-controlled amount, 3DS requested; sandbox only |
| Monthly initial payment | API `src/billing.ts`; POST `/billing/monthly` → Snap | IDR 39000; explicit recurring consent, persisted idempotency, method activation gates |
| Card token | Verified initial transaction GET → saved token | Server only; merchant Card One Click/Recurring approval unconfirmed |
| GoPay token | Verified initial transaction → account GET → active wallet token | Server only; Tokenization/Recurring/No PIN approval unconfirmed |
| Subscription scheduling | POST `/v1/subscriptions`; provider-owned monthly schedule | Persisted provider ID, idempotency, three daily retries; actual provider lifecycle unverified |
| Ordinary webhook | POST `/billing/midtrans/notify` | SHA512 exact amount string, timing-safe signature, provider status GET, amount/order verification, durable once-only grant |
| Recurring webhook | POST `/billing/midtrans/recurring` | Untrusted trigger; authenticated subscription + transaction GET verify association, amount, method and cycle; no browser grant |
| Missed initial webhook | GET `/billing/orders/:id?refresh=1` | Fixed in this audit: verifies and fulfills both plans; private to payer |
| Missed renewal / provisioning | Minute worker in `src/server.ts` / `reconcileBilling` | Durable row claims, provider polling, cancellation retry; latest three transaction IDs considered |
| Cancellation | POST `/billing/subscriptions/:id/cancel` → provider cancel | Payer ownership, paid access preserved, no logout cancellation; actual provider cancellation proof needed |
| Monthly → lifetime | Lifetime verified payment → stop recurring | Lifetime cannot be overwritten by late monthly renewal; cancellation recovery tested locally |
| Entitlement → features | `/me`, `hasPlus`, client sync/store | Household scoped, monthly expiry enforced, Free downgrade hides rather than deletes data |
| Public app → VPS | `vercel.json` rewrites to `http://43.157.248.192` | **Blocker: unencrypted origin hop carries bearer tokens and user data** |
| Refund / chargeback | No automated entitlement reversal found | **Blocker: agreed policy and tested operator reconciliation needed** |
| Other gateways / BI-SNAP | No integration found | No second provider to audit; current product uses Snap + classic Subscription API |

## Free and Plus scope

Free: pregnancy/newborn setup, core logs, 30-day ASI/pump/diaper history, full bottle history, opt-in household sync and partner access, limited PDF export. Backend blocks additional baby profiles and public wishlist sharing without Plus. Device-local limits such as disconnected Free PDF quota are best effort.

Plus: feeding estimates, foreground reminders, seven-day charts, full history, unlimited PDF, revocable seven-day wishlist links with guest claims, multiple baby profiles. Current automated checks cover calculations, isolation, downgrade preservation, PDF generation and reminder behavior. This audit did not repeat every visual or hardware check. iPhone/iPad installation/storage recovery and actual device notification delivery remain acceptance checks. Reminders require the app to be open; they are not background scheduled push notifications.

## Launch blockers and owners

| Priority | Required action | Owner | Acceptance evidence |
| --- | --- | --- | --- |
| P0 | Complete Midtrans business review and confirm Momong merchant identity | Evan / Midtrans | Production merchant approved; enabled payment methods confirmed; hosted merchant display name checked |
| P0 | Add public HTTPS API origin and change Vercel rewrites | Evan chooses domain; implementation can follow | Valid origin certificate, HTTPS rewrites, auth/sync/webhook smoke tests, no public HTTP path carrying user data |
| P0 paid | Wire production host selection across every provider call and frontend redirect allowlist together | Engineering, after merchant approval | Production keys isolated, plan response reflects real environment, webhook/status/subscription/cancel use correct hosts, sandbox suite stays green |
| P0 public | Publish accurate privacy, payment terms, support contact, refund/cancellation policy | Evan approves business facts; engineering publishes | Links visible before signup/payment; recurring consent matches actual terms; deletion/support procedure documented |
| P0 paid | Define and test refund/chargeback entitlement reconciliation | Evan decides policy; engineering/ops implement | Full/partial refund behavior, cancellation and retained access rules verified; replay safe |
| P0 paid | Prove full backup and restore plus billing monitoring | Operations | Restore to isolated DB; reconciliation after restore; alerts for attention/cancel_pending/provider failure and owner identified |
| P0 recurring | Confirm recurring activation separately for card and GoPay | Evan / Midtrans | Merchant confirmation for each target environment; leave unconfirmed methods disabled |
| P0 recurring | Complete actual sandbox lifecycle | Engineering + dashboard access | Initial linking/payment, 3DS, renewal, failed retries, expiry, cancellation, lifetime upgrade, delayed/replayed notifications, month/leap boundaries |
| P1 | Improve unknown checkout / provisioning operator workflow | Engineering / ops | Locate provider transaction/subscription, recover ID safely; no blind replacement charge |
| P1 | Verify email and Google customer flows live | Engineering + test mailbox | Delivered magic link, callback, Google consent/callback and return-to-Plus confirmed |
| P1 | Hardware acceptance | Evan / device tester | iOS browser → backup → install → restore → offline; foreground reminder delivery and OS PDF save |

No privacy/refund/support pages were found by source search. Their wording cannot be inferred safely from code. Current `PRODUCTION-READINESS.md` and parts of `PLUS-RELEASE.md` contain older evidence (including absent keys and no monthly flow); this dated report supersedes those snapshots for current state, while their historical provider proofs remain historical.

## Provider proof still needed

Earlier release notes record a sandbox lifetime capture and webhook activation; a subsequent real 3DS challenge remained pending. Those are repository historical evidence, not new provider payments completed by this audit. Current tests use mocked provider responses. This audit did not create any real-money transaction or enable production.

For monthly, current documentation confirms Subscription API accepts card and GoPay and uses a dedicated recurring notification URL. It requires merchant activation and tokens from verified initial payment/linking. Local code matching API syntax does not prove the merchant can charge recurring payments.

Configure and verify independently:

- Payment Notification URL: `https://momong.vercel.app/billing/midtrans/notify`
- Recurring Notification URL: `https://momong.vercel.app/billing/midtrans/recurring`
- Finish URL: `https://momong.vercel.app/?payment_return=1#/plus`

Dashboard values and activated methods were not inspected in this audit. Browser return is UX only; provider verification grants access.

## Smallest launch sequence

1. Finish API TLS, public privacy/support information and device/account acceptance while Midtrans reviews the business.
2. For a public Free launch, decide how to hide or disable sandbox purchase CTAs; current public lifetime checkout is a test checkout, not real payment.
3. After merchant approval, complete sandbox acceptance, production configuration and reviewed operating procedures. Lifetime first is the smallest paid release; adding monthly requires its separate lifecycle evidence.
4. Run an explicitly agreed small live transaction, observe paid state/entitlement and notification recovery, and verify the refund procedure. Then open the corresponding paid methods publicly.

The goal of public Free usage plus actual payment remains unfinished while merchant approval and the P0 gates remain outstanding.

## Current primary documentation

- https://docs.midtrans.com/reference/create-subscription
- https://docs.midtrans.com/reference/get-subscription
- https://docs.midtrans.com/reference/http-notification
- https://docs.midtrans.com/reference/subscription-schedule-object
- https://docs.midtrans.com/docs/https-notification-webhooks
- https://docs.midtrans.com/docs/switching-to-production-mode

Current docs were retrieved through Context7 and the official Markdown endpoints during this audit. No provider credentials were included in documentation queries.

## Recurring correctness follow-up

Two additional defects were fixed and deployed without activating monthly methods:

- **Cancellation before first payment:** the worker now processes `cancel_pending` even without a paid period. The subscription becomes cancelled immediately when nothing was provisioned; an eventual initial payment still grants its paid month without restarting recurring. A regression test covers the full route/recovery sequence.
- **End-of-month renewal:** renewal end is calculated from the original provider schedule anchor. A January 31 schedule renewing on February 28/29 now grants through March 31, rather than shortening access to March 28/29. Regression checks cover ordinary and leap years.

All 16 API tests and the API build pass. Backup for this patch: `/opt/momong-api/release-backups/recurring-20261006/`. Actual Midtrans renewal/calendar behavior remains a provider acceptance gate; these fixes are deterministic local evidence. Recurring flags and real payments remain disabled.
