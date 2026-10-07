import assert from "node:assert/strict";
import { test } from "node:test";
const events = new EventTarget();
const media = Object.assign(new EventTarget(), { matches: false });
let focused = "";
let scrolled = 0;
const heading = { tabIndex: 0, focus: () => { focused = "heading"; } };
const origin = { getAttribute: () => "#/bag", focus: () => { focused = "origin"; } };
Object.assign(globalThis, {
  addEventListener: events.addEventListener.bind(events),
  removeEventListener: events.removeEventListener.bind(events),
  matchMedia: () => media,
  document: { documentElement: { dataset: {} }, querySelector: () => heading, querySelectorAll: () => [origin] },
  location: { hash: "#/" },
  history: { state: null, scrollRestoration: "auto", replaceState(state: unknown) { this.state = state; } },
  scrollY: 0,
  window: { scrollTo: ({ top }: { top: number }) => { scrolled = top; } },
});
const motion = await import("./motion.ts");
const route = await import("./route.ts");

test("tabs and details commit immediately without native snapshots; obsolete entrances are cleared", () => {
  let count = 0, snapshots = 0;
  (document as any).startViewTransition = () => { snapshots++; };
  motion.navigate("/", "/log", () => { count++; });
  motion.navigate("/log", "/laporan", () => { count += 10; });
  assert.equal(count, 11);
  motion.navigate("/log", "/profil", () => { count++; });
  assert.equal(motion.afterNavigate(), undefined);
  assert.equal(count, 12);
  assert.equal(snapshots, 0);
  delete (document as any).startViewTransition;
});

test("reduced motion changes and keyboard interaction cancel active feedback", () => {
  let cancelled = 0, started = 0;
  const el = { animate: () => { started++; return { cancel: () => { cancelled++; }, finished: new Promise(() => {}) }; } } as unknown as Element;
  motion.animate(el, [], 180);
  media.matches = true; media.dispatchEvent(new Event("change"));
  assert.equal(cancelled, 1);
  motion.animate(el, []);
  assert.equal(started, 1);
  media.matches = false;
  events.dispatchEvent(new Event("keydown"));
  motion.animate(el, []);
  assert.equal(started, 1);
  events.dispatchEvent(new Event("pointerdown"));
  const stop = motion.animate(el, []);
  stop();
  assert.equal(cancelled, 2);
});

test("browser Back/Forward and explicit detail return restore scroll and originating focus", () => {
  const homeState = history.state;
  (globalThis as any).scrollY = 420;
  events.dispatchEvent(new Event("scroll"));
  // Record the actual originating link without depending on a React render.
  const click = new Event("click");
  Object.defineProperty(click, "target", { value: { closest: () => origin } });
  events.dispatchEvent(click);
  const change = (hash: string, state: unknown = null) => {
    location.hash = hash; (history as any).state = state;
    events.dispatchEvent(new Event("hashchange")); route.restoreRoutePosition();
  };
  change("#/bag", homeState);
  assert.equal(scrolled, 0);
  const detailState = history.state;
  (globalThis as any).scrollY = 180; events.dispatchEvent(new Event("scroll"));
  change("#/", homeState);
  assert.equal(scrolled, 420); assert.equal(focused, "origin");
  change("#/bag", detailState);
  assert.equal(scrolled, 180);
  change("#/");
  assert.equal(scrolled, 420); assert.equal(focused, "origin");
});
