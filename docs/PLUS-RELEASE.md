# Momong Plus release verification

## Deployed implementation

Client a1159ca and API 0cd330b50c4a9938e60dc01bc5339c12398dfd7d are deployed. Public title and manifest use Momong; existing origin, manifest identity and bb_ storage remain unchanged. API source hash was checked against the VPS deployment.

38 client tests and 13 API tests passed, along with both builds. Automated checks cover backup validation/rollback, entitlement and billing boundaries, provider verification, replay and ownership. Browser checks covered anonymous direct Plus routing, returning to Free, backup restore, newborn profile without HPL, plan selection and expanded sheet, installation tutorial, focus restoration, and mobile light/dark layouts. These are bounded checks, not a claim that every hardware or provider scenario has passed.

Lifetime sandbox order bb-lt-cebb80636749410f8d7ff0a01fe05f58-muvjh152 reached capture via hosted Midtrans. The verified webhook granted plus_lifetime, confirmed by authenticated order status and /me. No real money was charged. No 3DS challenge appeared in this run.

## Remaining acceptance checks

- Confirm merchant Card One Click/Recurring and GoPay Tokenization/Recurring/No PIN activation before enabling each monthly method. Both readiness flags remain disabled.
- Complete actual monthly linking, initial payment, renewal, failed-renewal retries, cancellation and lifetime upgrade against Midtrans, including calendar boundaries and ambiguous provisioning recovery.
- Secure lifetime card checkout is deployed (API c53839e); a real sandbox 3DS 2.0 challenge appeared on order bb-lt-ff6f9956adf1414b9547a7e65e4c3740-muvsfw77. OTP was entered, but the browser control could not submit the simulator iframe; transaction remains pending and entitlement was not granted. Complete the challenge before claiming 3DS E2E.
- Local account fixtures verified non-member, monthly active and lifetime active pages, including expiry, cancellation control, feature links and absence of repeat lifetime checkout. Shared partner and recovery visual checks remain.
- Magic-link callback now consumes the same allowed authentication destination as password/Google callbacks, preserving return-to-Plus intent.
- Review hosted merchant display name Gainz; do not change another product merchant account without an explicit decision.
- On real iPhone/iPad: browser data → backup → homescreen installation → restore → reload/offline, and separately opt-in sync recovery. Browser and homescreen storage can be separate; installation does not copy localStorage.

## Production readiness planning

After the remaining sandbox and feature acceptance checks pass, review: production merchant activation and branding; HTTPS API routing; secret/environment separation; notification and return URLs; reconciliation, cancellation and refund operations; monitoring and alert ownership; rollback and database backup; privacy and payment terms; and a merchant-approved live smoke-test protocol.

Produce a reviewed checklist with owners and evidence before wiring live endpoints. Monthly/trial changes need a separate product decision. Live remains disabled and requires explicit Evan approval.


## Feature completion slice — 2026-10-06

40 client tests, 13 API tests and both builds pass. No new dependency, price, trial, recurring activation or live endpoint was introduced. API 882d363 adds expiresAt to public wishlist reads without a migration.

| Capability | Evidence |
| --- | --- |
| Next-feed | Home and Insight show the same estimate/sample count; second baby with insufficient sessions shows the non-clinical empty state. Median/distinct-session calculation tested. |
| Reminders | Browser create/edit/delete/reload and baby isolation passed. Automated delivery check covers foreground, persisted once-only state, downgrade and timer cleanup. Multiple due reminders share one summary; device permission failures stay visible. |
| Charts | Seven dated rows and accessible values verified against fixture feeding/pump/diaper totals; second profile shows only its own data. |
| History | Browser incremental load 30 → 60 and kind filter passed. Pump history 37 Plus → 36 Free → 37 Plus proves hidden old data returns without deletion. |
| PDF | Profile and period selectors verified; newborn omits HPL, pregnancy retains it. Free success uses quota; a separate font-503 browser scenario keeps quota and displays error. Production local build reloads and generates PDF after its server stops. Unit test verifies font embedding and multipage PDF bytes. The in-app browser did not expose a downloadable file event, so OS file save/viewer handling is not claimed. |
| Wishlist | Public deployment tested with the previously webhook-activated lifetime sandbox account: publish 200, expiry returned, claim 200, duplicate claim 409, visible claim, revoke 200, revoked read 404. Deterministic API checks additionally cover other-household revoke refusal, expiry and explicit republish. |
| Multi baby | Browser selection isolates report/reminders/insight; adding Rara switches to an empty newborn context. Pregnant mode recovers saved HPL. Store tests preserve HPL and records through mode change/downgrade. |

Mobile 390×844 and desktop checks used light/dark themes and existing native controls. Existing keyboard dialog focus/restore and reduced-motion rules remain; compact buttons are at least 44px. Native notification permission delivery, OS share/WhatsApp destinations, screen-reader hardware, and real iPhone/iPad homescreen storage recovery require device checks. These are recorded limits, not completed hardware acceptance.

The offline asset builder now fingerprints the actual versioned cache template, preventing a stale cache version from skipping new PDF/runtime assets. Synthetic fixtures and provider test-session secrets remain outside the repository.
