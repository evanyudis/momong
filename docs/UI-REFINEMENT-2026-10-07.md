# Momong UI refinement — 7 October 2026

**Ship for this frontend refinement:** known software blockers addressed. Hardware and clinical review remain below. This is local verification, not a deployment or payment-readiness verdict.

## A. Accessibility

| Severity | Before | After | Why | Status |
| --- | --- | --- | --- | --- |
| BLOCKER | Immediate individual deletion in `src/screens/Log.tsx:417`, Bag and Wishlist | Shared `DeleteButton` confirmation in `src/ui.tsx:101`; Batal receives focus; failed persistence stays inline | Prevent accidental permanent deletion | Fixed |
| BLOCKER | Parent and child sheets both trapped focus | Nested background locks and top-dialog handling at `src/ui.tsx:34`; parent-first unmount releases locks correctly | Keyboard remains usable through nested confirmations and navigation | Fixed |
| SHOULD FIX | First toast mounted its live region only with content | Empty status region always mounted at `src/ui.tsx:494` | Screen readers can observe subsequent message updates | Fixed; VoiceOver check remains |
| POLISH | Browser-default focus colors differed across controls | Neutral `:focus-visible` at `src/styles.css:124` | Consistent visible keyboard focus | Fixed |

## B. Performance

| Severity | Before | After | Why | Status |
| --- | --- | --- | --- | --- |
| SHOULD FIX | Geist discovered through Google Fonts stylesheet | Same Latin Geist WOFF2 served locally and preloaded at `index.html:14`; included in `scripts/offline-assets.mjs:3` | Removes remote font discovery and allows offline font caching | Fixed |

Font license included at `public/fonts/Geist-LICENSE.txt`. Existing weights 400–700 retained; no dependency added.

## C. Mobile

| Severity | Before | After | Why | Status |
| --- | --- | --- | --- | --- |
| SHOULD FIX | Long toast could extend beyond viewport | Safe-area-aware maximum width and wrapping at `src/styles.css:602` | Long item names remain readable without horizontal overflow | Fixed |
| POLISH | Warm browser/PWA chrome differed from neutral canvas | Canvas-matching chrome in `index.html:6`, `src/screens/Profil.tsx:23`, and manifest | Consistent launch and theme surfaces | Fixed |

Viewport zoom, 16px+ inputs, dvh shell, safe areas, and gated hover preserved.

## D. Forms

| Severity | Before | After | Why | Status |
| --- | --- | --- | --- | --- |
| SHOULD FIX | Milk input minimum disagreed with save validation | Minimum 1 ml at `src/screens/Log.tsx:489` | Native validation agrees with accepted amounts; zero remains disabled | Fixed |

Existing labels, auth pending locks and native date controls preserved.

## E. Stability and states

| Severity | Before | After | Why | Status |
| --- | --- | --- | --- | --- |
| BLOCKER | Invite rejection swallowed; sharing remained disabled | Loading, announced error and retry at `src/screens/Partner.tsx:129` and `:221` | Users can understand and recover from invite failure | Fixed |
| SHOULD FIX | Render failure had no recovery UI | App-level `src/ErrorBoundary.tsx:3` offers reload and keeps local records | Recoverable failure replaces a blank screen | Fixed |
| SHOULD FIX | Filtered empty history looked like no records existed | Specific empty-filter message and reset at `src/screens/Log.tsx:408` | Existing records are discoverable again | Fixed |
| SHOULD FIX | Toast expired while tab was hidden | Visibility-paused countdown at `src/ui.tsx:460` | Feedback remains available after returning | Fixed |
| SHOULD FIX | Every page retained the same document title | Actual rendered heading drives title at `src/App.tsx:78`, including internal onboarding steps | Tabs identify the current screen | Fixed |

## F. Motion

Clean for the agreed scope: existing transform/opacity transitions, keyboard bypass and reduced-motion handling retained. Route motion tests verify cancellation on keyboard/reduced-motion changes. Device performance remains unverified.

## G. Theming and visual refinement

| Severity | Before | After | Why | Status |
| --- | --- | --- | --- | --- |
| BLOCKER | Faint, success and danger text failed contrast | Muted caption alias, darker light success and accessible field-danger treatment at `src/styles.css:15`, `:29`, `:33` | Supporting information and destructive actions stay readable | Fixed |
| POLISH | Card blur over flat canvas | Opaque product cards at `src/styles.css:167`; floating navigation/control glass retained | Depth has a clear purpose | Fixed |
| POLISH | Layered gradient/shadow glyphs and duplicate metric icon tiles | Flat glyphs at `src/styles.css:191`; direct icons in newborn metrics | Removes repeated decoration | Fixed |
| POLISH | Plus badge stacked borders, gradient, shadow and shine | Flat blush, one border, emblem and text at `src/styles.css:583` | Keeps the product marker with fewer effects | Fixed |

AA regression checks cover caption tokens in both themes and all five flat glyph combinations. Calculated minimum caption contrast is 4.53:1 and minimum glyph contrast is 4.65:1. Success on its tinted surface is 5.00:1; destructive button text is 5.91:1 light and 6.97:1 dark.

## H. Content and leftovers

| Severity | Before | After | Why | Status |
| --- | --- | --- | --- | --- |
| BLOCKER | Week 34–36 copy normalized slower movements | Approved replacement at `src/content.ts:40` directs reduced/changed movement to a midwife or doctor | Removes unsupported reassurance; consistent with [NHS guidance](https://www.cuh.nhs.uk/patient-information/reduced-fetal-movements/) | Fixed; clinical review remains |
| POLISH | Plus repeated Segera hadir nine times and used an abstract headline | One disabled CTA; concrete feature headline at `src/screens/Plus.tsx:33`; 28px/1.2 without narrow measure at `src/styles.css:739` | Clearer hierarchy with less repetition | Fixed |

No fabricated testimonials, stats, prototype routes or debug inspectors were added. Guest/account onboarding and stored records retained.

## I. Marketing and SEO

| Severity | Before | After | Why | Status |
| --- | --- | --- | --- | --- |
| SHOULD FIX | No share-preview image | Actual product screenshot at `public/og-momong.jpg`; OG, Twitter card and canonical metadata at `index.html:16` | Public links have a real product preview without personal data | Fixed locally |

No separate blog/marketing route was introduced. Preview URLs become public only after deployment.

## Needs a device

- iPhone Safari/PWA: open date and numeric inputs, check keyboard clearance and home-indicator spacing; confirm no unexpected zoom.
- VoiceOver: hear the first toast, failed invite and delete error; verify Tab/Escape and focus return in nested confirmations.
- Older Android: scroll and open/close sheets rapidly in both themes; look for dropped frames.
- First visit/offline reload on a real phone: confirm the locally cached font and UI remain available after service-worker installation.

## Needs a human

- A maternity clinician should review pregnancy guidance before wider promotion; the misleading sentence was already replaced. Owning checklist: emil-prep-for-prod, content lane.
- Payment activation and actual production settlement remain separate release checks. This pass did not change flags, prices, credentials or billing behavior.

## Verification

Final automated results:

```text
rtk npm test
ℹ tests 53
ℹ pass 53
ℹ fail 0

rtk npm run build
> tsc && vite build && node scripts/offline-assets.mjs
✓ built in 653ms

rtk git diff --check
(exit 0; no output)
```

Tests still emit the existing `WebSocket server error: Port 24678 is already in use` warning; all tests passed.

Browser checks passed using isolated in-memory storage and mocked API:

- Delete cancellation, persistence failure and retry; initially mounted live region.
- Filtered-empty reset restores existing records.
- Nested confirmation focus, Escape and focus restoration.
- Long toast wrapping and hidden-tab countdown pause/resume.
- Failed invite followed by successful retry enables sharing.
- Actual render exception enters recovery while records remain available.

Route matrix: 240 combinations = 15 routes × 4 widths (320/375/430/1280) × 2 themes × 2 modes. No blank main surfaces, horizontal overflow or stale titles. These checks used real iframe viewport widths because the browser viewport override did not apply. They do not prove hardware behavior or populated/long-content states on every screen.

Rerun on the Vite dev server: `/scripts/refinement-check.html` for behavior; `/scripts/refinement-responsive.html` for the route matrix. Fixtures never use the browser's actual storage and do not reach the real API. Build verification confirms these dev-only files are excluded from dist, the font is precached, and the OG image is packaged.

Evidence: `docs/design/refinement/responsive-light.jpg`, `docs/design/refinement/home-dark.jpg`. The OG screenshot also shows the refined public Plus surface.

All changes remain local. No commit or deployment was created. Existing unrelated working-tree changes were preserved.
