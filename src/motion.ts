// Page motion (emil-animations): WAAPI on transform + opacity only, no animation library.
// Enter: ease-out cubic-bezier(0.32, 0.72, 0, 1), 300–400ms. Exit: ~25% faster, quieter, ease-in.
// Reduced motion and keyboard-initiated navigation get no motion at all.

export const EASE_OUT = "cubic-bezier(0.32, 0.72, 0, 1)";
const EASE_IN = "cubic-bezier(0.55, 0, 1, 0.45)"; // exit half of the pairing only
const ENTER_MS = 320;
const EXIT_MS = 240;

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// Keyboard-initiated navigation is never animated.
let viaKeyboard = false;
addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") viaKeyboard = true; }, true);
addEventListener("pointerdown", () => { viaKeyboard = false; }, true);

// A tapped card marked data-morph="/path" becomes the shared element for that destination.
let source: { path: string; rect: DOMRect } | null = null;
addEventListener("click", (e) => {
  const el = (e.target as Element | null)?.closest?.("[data-morph]");
  source = el ? { path: el.getAttribute("data-morph")!, rect: el.getBoundingClientRect() } : null;
}, true);

type Plan = { kind: "into"; rect: DOMRect } | { kind: "back"; from: string };
let plan: Plan | null = null;

const main = () => document.querySelector<HTMLElement>("main.app");
const done = (a: Animation, el: Element) => a.finished.then(() => el.remove(), () => el.remove());

/** Runs on hashchange, before React renders the next route: snapshot the old page and let it leave. */
export function beforeNavigate(from: string, to: string) {
  plan = null;
  const tapped = source;
  source = null;
  const page = main();
  if (!page || reducedMotion() || viaKeyboard || from === to) return;

  // Static snapshot of the outgoing page, so it can exit while the new route mounts underneath.
  const layer = document.createElement("div");
  layer.className = "page-leaving";
  layer.setAttribute("aria-hidden", "true");
  layer.inert = true;
  const clone = page.cloneNode(true) as HTMLElement;
  clone.style.transform = `translateY(${-scrollY}px)`;
  layer.append(clone);
  document.body.append(layer);
  done(layer.animate(
    [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-8px)" }],
    { duration: EXIT_MS, easing: EASE_IN, fill: "forwards" },
  ), layer);

  plan = tapped && tapped.path === to ? { kind: "into", rect: tapped.rect } : { kind: "back", from };
}

/** Runs in a layout effect after the next route is in the DOM. */
export function afterNavigate() {
  const p = plan;
  plan = null;
  const page = main();
  if (!p || !page) return;
  if (p.kind === "into") {
    morph(p.rect, "grow");
    enterPieces(page, 140);
    return;
  }
  // Returning to the screen that holds the source card: the page shrinks back into it.
  const card = page.querySelector(`[data-morph="${CSS.escape(p.from)}"]`);
  if (card) morph(card.getBoundingClientRect(), "shrink");
  enterPieces(page, 60);
}

/** Shared-element morph: a surface grows from the card to the page (or back), transform + opacity only. */
function morph(rect: DOMRect, dir: "grow" | "shrink") {
  const ghost = document.createElement("div");
  ghost.className = "morph-ghost";
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.width = `${innerWidth}px`;
  ghost.style.height = `${innerHeight}px`;
  document.body.append(ghost);
  const at = `translate(${rect.left}px, ${rect.top}px) scale(${rect.width / innerWidth}, ${rect.height / innerHeight})`;
  const frames = dir === "grow"
    ? [
        { transform: at, opacity: 0 },
        { transform: at, opacity: 1, offset: 0.1 },
        { transform: "none", opacity: 1, offset: 0.75 },
        { transform: "none", opacity: 0 },
      ]
    : [
        { transform: "none", opacity: 0 },
        { transform: "none", opacity: 1, offset: 0.15 },
        { transform: at, opacity: 1, offset: 0.8 },
        { transform: at, opacity: 0 },
      ];
  // Shrinking back is the exit direction: ~20% shorter.
  done(ghost.animate(frames, { duration: dir === "grow" ? 380 : 300, easing: EASE_OUT, fill: "forwards" }), ghost);
}

/** Split, then stagger: header and each card rise in, never one monolithic wrapper. */
function enterPieces(page: HTMLElement, delay: number) {
  const pieces = [...page.children].flatMap((c) => (c.classList.contains("stack") ? [...c.children] : [c])).slice(0, 7);
  pieces.forEach((el, i) => {
    (el as HTMLElement).animate(
      [{ opacity: 0, transform: "translateY(8px) scale(0.97)" }, { opacity: 1, transform: "none" }],
      { duration: ENTER_MS, delay: delay + i * 30, easing: EASE_OUT, fill: "backwards" },
    );
  });
}

/** First-run progress fill (segments, bars): rise from scaleX 0.6 + fade, staggered. */
export function fillIn(els: Iterable<Element>, delay = 120) {
  if (reducedMotion()) return;
  [...els].forEach((el, i) => {
    (el as HTMLElement).animate(
      [{ opacity: 0, transform: "scaleX(0.6)" }, { opacity: 1, transform: "none" }],
      { duration: 300, delay: delay + i * 35, easing: EASE_OUT, fill: "backwards" },
    );
  });
}
