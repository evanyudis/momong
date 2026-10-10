import assert from "node:assert/strict";
import { test } from "node:test";
const events = new EventTarget();
let coarse = true;
let active: unknown;
const element = () => ({ isConnected: true, focus() { active = this; }, getClientRects: () => [1], closest: () => null });
const previous = element(), heading = element(), first = element(), last = element(), explicit = element();
const background = [{ inert: false }, { inert: true }];
const doc = {
  head: { appendChild() {} }, createElement: () => ({ appendChild() {} }), createTextNode: (text: string) => text,
  get activeElement() { return active; },
  documentElement: { style: { overflow: "auto" }, dataset: {} }, body: { style: { overflow: "" } },
  querySelectorAll: () => background,
  addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
};
Object.assign(globalThis, { document: doc, window: {}, addEventListener() {}, matchMedia: (query: string) => ({ matches: query.includes("coarse") && coarse, addEventListener() {} }) });
const { containDialogFocus } = await import("./ui.tsx");
const dialog = { ...element(), querySelector: () => heading, querySelectorAll: () => [first, last], contains: (el: unknown) => [heading, first, last, explicit].includes(el as any) } as unknown as HTMLElement;
const key = (name: string, shiftKey = false) => events.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: name, shiftKey }));
test("touch sheets focus their heading, trap Tab, dismiss Escape, and release background locks", () => {
  active = previous;
  let closed = 0;
  const stop = containDialogFocus(dialog, () => { closed++; });
  assert.equal(active, heading);
  assert.deepEqual(background.map((el) => el.inert), [true, true]);
  active = last; key("Tab"); assert.equal(active, first);
  key("Tab", true); assert.equal(active, last);
  key("Escape"); assert.equal(closed, 1);
  stop();
  assert.equal(active, previous);
  assert.equal(doc.documentElement.style.overflow, "auto");
  assert.equal(doc.body.style.overflow, "");
  assert.deepEqual(background.map((el) => el.inert), [false, true]);
  key("Escape"); assert.equal(closed, 1);
  const reopen = containDialogFocus(dialog, () => {}); reopen();
  assert.equal(active, previous);
});
test("optional initial focus overrides the touch default; desktop uses the first control", () => {
  let stop = containDialogFocus(dialog, () => {}, explicit as unknown as HTMLElement);
  assert.equal(active, explicit); stop();
  coarse = false;
  stop = containDialogFocus(dialog, () => {});
  assert.equal(active, first); stop();
});

test("nested sheets suspend the parent trap and restore it on close", () => {
  const parent = { ...element(), inert: false };
  const child = { ...dialog, inert: false } as HTMLElement;
  const query = doc.querySelectorAll;
  doc.querySelectorAll = () => [...background, parent] as any;
  active = previous;
  const stop = containDialogFocus(child, () => {});
  assert.equal(parent.inert, true);
  active = last; key("Tab"); assert.equal(active, first);
  stop();
  assert.equal(parent.inert, false);
  assert.equal(active, previous);
  doc.querySelectorAll = query;
});

test("parent-first unmount of nested sheets releases all background locks", () => {
  const query = doc.querySelectorAll;
  const parent = { ...dialog, inert: false } as HTMLElement;
  const child = { ...dialog, inert: false } as HTMLElement;
  doc.querySelectorAll = () => background;
  const stopParent = containDialogFocus(parent, () => {});
  doc.querySelectorAll = () => [...background, parent] as any;
  const stopChild = containDialogFocus(child, () => {});
  stopParent();
  assert.equal(background[0].inert, true);
  stopChild();
  assert.equal(background[0].inert, false);
  assert.equal(background[1].inert, true);
  doc.querySelectorAll = query;
});
