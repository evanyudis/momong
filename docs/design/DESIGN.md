# Momong product surfaces

Source of truth: src/styles.css. React components use plain CSS and Geist; no second styling system or invented logo. The shipped geometric icon is unchanged. Public copy says Momong; bb_ storage and record/product identifiers remain stable.

## Tokens and surfaces

| Token | Light | Dark | Use |
|---|---|---|---|
| --bg | oklch(0.985 0 0) | oklch(0.191 0 0) | Canvas |
| --surface | oklch(1 0 0) | oklch(0.226 0 0) | Forms, sheets, previews |
| --ink | oklch(0.475 0 0) | oklch(0.94 0 0) | Body and prices |
| --ink-muted | oklch(0.556 0 0) | oklch(0.72 0 0) | Supporting copy |
| --plus-fill | --blush-100 | --blush-900 | Plus hero and selected plan |
| --plus-pill | --blush-500 | --blush-500 | Activation message |
| --signin-primary | --sky-500 | --sky-500 | Account CTA |

Actual color change audit: --plus-muted is new: oklch(0.50 0 0) in light and oklch(0.72 0 0) in dark. Supporting copy on coral previously inherited --ink-muted (light 0.556), which falls below 4.5:1 on blush. The new semantic token keeps Plus body copy above 4.5:1. Measured WCAG contrast: Plus supporting text 5.17:1 light and 6.33:1 dark; price text 5.75:1 light and 13.18:1 dark. Other palette values are unchanged. Plus selectors, preview bars and hero reuse the existing OKLCH coral ramp. Blue stays with account/sync. Selection now uses --plus-fill rather than an unconditional light blush. Existing accent hex values remain for older surfaces. Borders separate list rows; --elevation-raised supplies existing elevation.

## Components and variants

- PlusSheet preserves variant/onClose: overview, insights, perkiraan, pdf. Price and lifetime/monthly radios appear in compact state. Expanded state adds seven benefits. Compact benefits are inert.
- PlanPicker uses native fieldset/legend/radios. Default lifetime; selection persists in sessionStorage across authentication. It does not create an order.
- Plus page: non-member plan selection + example preview; active monthly/lifetime feature links; shared entitlement badge; payment status and payer-only history/cancellation. Monthly requires method readiness and explicit recurring consent. Offline checkout is disabled.
- Profil: account identity, membership, baby selection, detail editor sheet, mode, theme, sync/export, install entry, logout or anonymous reset. Only pregnant profiles show HPL; switching modes preserves it.
- InstallSheet: iOS, Android, computer tutorial; native prompt where available; standalone status. Backup and optional Free sync precede installation.
- Restore: local file validation, summary, explicit confirmation; anonymous empty database only. JSON import never restores account/payment credentials or enables sync/notifications.

## Interaction rules

All primary touch controls are at least 44px. Native controls have labels and focus rings. Shared sheets retain focus trap, restore, Escape, scroll lock and safe areas. Plan radios stop sheet drag propagation. Plus motion uses transform/opacity; direction reversals retarget the current pose. Activation lasts 1 second, once for a server-verified entitlement period; keyboard and reduced motion omit it.

No fake user data: the Plus page preview is marked CONTOH. Charts elsewhere use local records and expose numeric summaries. Non-clinical estimates need three recent sessions. Reminder copy always says the app must remain open.

## Verification limits

Local automated tests exercise backup validation/rollback, both modes, scoped records and downgrade, estimate/chart calculations, PDF pagination, opt-in sync and logout. API tests mock provider transport and exercise verified billing, replay, ownership, consent, amount checks and cancellation.

Real iPhone/iPad storage isolation, notification permissions and native install acceptance still require hardware. A real hosted sandbox payment, GoPay linking and acquiring-bank recurring activation are separate release checks. Never call mock tests a completed sandbox transaction.


## Plus feature completion

Report offers a native profile selector and period selector; selecting a profile also selects that baby throughout the app. Profile-scoped screens remount when the effective baby changes, including downgrade to the default baby. PDF preview caps at 80 entries with an explicit explanation; export includes the whole chosen period. Export errors stay inline, and controls lock during generation.

Wishlist shows loading, expiry, offline guidance, claim conflict feedback and retry. Only explicit publish creates or renews a public snapshot. Expiry is returned by the API; revoke remains available after downgrade. Native reminder/profile forms read submitted FormData so autofilled date values are respected. Compact buttons have a 44px minimum height.
