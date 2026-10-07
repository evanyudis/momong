# Plus branding

Source: `src/styles.css` and `src/PlusMesh.tsx`. Keep the existing crimson/blush ramp; blue belongs to account and sync.

Use `<PlusMesh />` inside `.plus-card`, `.plus-hero` and `.paywall-panel`. The decorative layer stays behind content with pointer events disabled. Profile, Insight, Home estimate, shared Wishlist, every Plus page state and all PlusSheet variants share it. `.plus-pill` and standalone `.plus-entry` controls use a static CSS mesh, avoiding extra WebGL contexts on tiny controls.

## Color audit

`--plus-pattern-ink` remains light `oklch(0.50 0.12 12)`, dark `oklch(0.78 0.10 12)` and now supplies the static mesh fallback. The shader uses existing crimson `#a24d59`, blush `#e8a0a8`, pale crimson `#f2bfc5` and deep crimson `#401b25` at 18% opacity over the original Plus surface. Text tokens and release/payment gates remain unchanged.

## Motion and performance

Paper Design MeshGradient loads in a separate chunk. Speed is 0.08 with no grain, minimum pixel ratio 1 and a 180,000 pixel cap per surface. Paper handles ResizeObserver, offscreen pause, hidden-tab pause and disposal. No React state updates per frame. Reduced motion skips WebGL entirely and uses the CSS fallback; loading or WebGL failure also retains this fallback. No entrance or theme color animation.

## Source

[Paper Shaders](https://github.com/paper-design/shaders), MIT licensed. Package license ships with the dependency. Hero Patterns assets have been removed.
