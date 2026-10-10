export const EASE_OUT = "cubic-bezier(0.32, 0.72, 0, 1)";
export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let keyboard = false;
const animations = new Set<Animation>();
let enter = false;

export const instantMotion = () => keyboard || reducedMotion();
function stopMotion() {
  animations.forEach((a) => a.cancel());
  animations.clear();
}
const onKey = () => { keyboard = true; document.documentElement.dataset.keyboard = "true"; stopMotion(); };
const onPointer = () => { keyboard = false; delete document.documentElement.dataset.keyboard; };
addEventListener("keydown", onKey, true);
addEventListener("pointerdown", onPointer, true);
const media = matchMedia("(prefers-reduced-motion: reduce)");
media.addEventListener("change", stopMotion);

/** One-shot feedback. The returned cleanup also handles unmounting mid-animation. */
export function animate(el: Element | null, frames: Keyframe[], duration = 180) {
  if (!el || instantMotion()) return () => {};
  const a = el.animate(frames, { duration, easing: EASE_OUT });
  animations.add(a);
  void a.finished.then(() => animations.delete(a), () => animations.delete(a));
  return () => { a.cancel(); animations.delete(a); };
}
export function acknowledge(el: Element | null, duration = 180) {
  return animate(el, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], duration);
}

/** Commit immediately; animate only the new detail surface, never overlapping page snapshots. */
export function navigate(from: string, to: string, update: () => void, back = false) {
  stopMotion();
  enter = from !== to && !instantMotion();
  document.documentElement.dataset.direction = back ? "back" : "forward";
  update();
}
export function afterNavigate() {
  const shouldEnter = enter;
  enter = false;
  if (shouldEnter) {
    const y = document.documentElement.dataset.direction === "back" ? -8 : 8;
    return animate(document.querySelector("main.app"), [
      { opacity: 0.85, transform: `translateY(${y}px)` },
      { opacity: 1, transform: "none" },
    ], 200);
  }
}

import.meta.hot?.dispose(() => {
  stopMotion();
  removeEventListener("keydown", onKey, true);
  removeEventListener("pointerdown", onPointer, true);
  media.removeEventListener("change", stopMotion);
});
