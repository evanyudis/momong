# Newborn design decisions

8 Oktober 2026. User approved production integration of Cap–Baris + day view.

Selected: Hari kecil illustration with Dekat card backbone. Order: baby identity/age → Activity Cap–Baris → Last feed → Feed estimate → Partner → Wishlist. Activity includes Lihat hari ini; Home has no record preview. Cap preserves playful decorative stamp and dominant bottle consumed volume, with three supporting icon/label/value rows. DBF remains separate. Infant age uses weeks plus completed calendar months/years and residual days.

Rejected: Pita too festive/outside Momong; Bon distinctive but rough/quiet; Fokus good hierarchy but insufficient character. Cap lower Kolom/Gabung rejected in favor of Baris. Card title role is consistent. Illustration pigments stay fixed across themes.

Dock: four navigation destinations in one glass capsule plus a separate Add button; floating kind menu opens the existing durable production sheet. Log contains dated history, filter and editing. Delete remains in edit with confirmation. Native-radio segments reuse existing CSS thumb transition. No new dependency.

Day view: seven dates centered on selection, edge fade beneath arrows, one-day animated steps, future dates disabled and muted with --nb-upcoming (OKLCH .68 light / .43 dark). Hari ini resets selection; dashboard's today link also resets filter. No extra day-summary card. Chronological compact Catatan cards use local start dates; ranges require known duration. Historical navigation does not change new-log default time.

Persistence, IDs, timer draft, Free history window, sync/partner, PDF and Plus release flags are retained. Plus estimate is visible as coming soon while disabled; unlocked estimate uses the existing nextFeed helper. Shared glass controls apply to both modes, with softened reflective rims, reduced-motion/transparency fallbacks. No production API/schema changes.

Prototype comparison sources are removed after integration; focused age/date/consumed-total checks move into the production test suite. No deployment or main-branch push was requested in this integration step.

Verification: 63 production tests passed (including promoted age/local-date/overnight/consumed-volume checks). Production build and whitespace check passed. Isolated browser profile verified bottle create/edit and persistence, day stepping/Today, 320/390/841px widths, muted future dates in both themes, fixed illustration colors, and DBF start → close → reload → resume → stop → save. Add focus restores after save. Prototype sources removed; docs retain the decisions.
