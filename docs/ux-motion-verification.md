# UX and motion implementation — 6 October 2026

Implemented primary-tab switching without page entrances, 150ms tab indication, immediate detail routing with a 200ms directional entrance on the live page, and Back/Forward scroll and originating-link focus restoration. Obsolete animations cancel on navigation, keyboard input, unmount, and reduced-motion changes.

Shared sheets retain 260/200ms transitions, have a 44px close control, accept optional initial focus, and focus headings on touch. React Aria's installed scroll lock contains the page; existing focus management remains. Checklist labels toggle native checkboxes across a 44px target. Newborn Log exposes the existing report card.

Onboarding preserves fields between its two steps and acknowledges persisted completion. Newborn saves guard repeated submits and use specific confirmation text. Failed local writes roll back in-memory state. Pregnancy kick sessions retain their completed count; only a locally added segment animates. Existing progress rings render immediately. Bag completion acknowledges only a local completing action. Mode switching saves immediately and requests HPL if it is missing. Empty newborn Insight leads to Log. Sync shows a spinner only while busy and a static check when synced. Plus activation stays readable after its 600ms entrance.

## Saved-record decision — Inline selected

The user selected **Inline** from the saved-record prototype. On successful persistence, the changed row enters with 6px upward movement and opacity over 180ms; a specific toast names the saved bottle/ASI/pump/diaper amount and type. The same row acknowledgment and specific confirmation now apply to saved or edited reminders, wishlist additions, successful shared gift claims, and the partner avatar when a newly joined member appears in confirmed household data. Error paths preserve their inputs and never show a success acknowledgment.

Expressive was declined because its added check flourish was unnecessary for repeated daily saves. Current was declined because a toast alone did not connect the action to its record. Keyboard input and reduced motion suppress the row animation while the text confirmation remains. These values replace the prototype controls: 180ms, opacity plus 6px vertical movement, with the existing ease-out token.

The isolated prototype directory was removed after promotion. No prototype route or picker remains in the application.

## Verification

- `npm test`: 46 tests pass. New regression coverage checks instant primary tabs, immediate detail commits without snapshots, cancellation during reduced-motion changes, Back/Forward and explicit detail return, heading/override focus, Tab containment, Escape, lock cleanup, and failed persistence/retry.
- `npm run build`: production TypeScript and Vite build pass.
- Prototype TypeScript check passes separately; production does not import the prototype.
- `git diff --check`: clean.
- Browser checks use a separate local origin with synthetic guest data. Verified onboarding selection and retained names, newborn empty/populated states, report discovery, double-click save creating one record, restored records after reload, Escape restoring focus and releasing scroll lock, missing-HPL mode switching, completed kick count after reload, label-based checklist toggles, action-only bag completion, and all prototype directions plus failed-save input retention.
- Existing account, sync, contraction, reminder, and PDF test suites pass. Authenticated partner joining, real server request failures, and payment activation were not exercised live.

## Remaining acceptance checks

Older iPhone Safari and Android hardware, keyboard-open forms, landscape, installed PWA behavior, screen-reader speech, and frame-pacing recordings remain unverified. Responsive desktop checks are not substitutes for hardware checks. Do not replace the existing shared focus management until iOS verification. No new animation dependency or backend API change was introduced. Pre-existing Plus-sheet edits were preserved.
