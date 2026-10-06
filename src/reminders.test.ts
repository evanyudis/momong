import assert from "node:assert/strict";
import { test } from "node:test";
(globalThis as any).addEventListener = () => {};
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { value: {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
}, configurable: true });
const { dueReminders, startReminders } = await import("./reminders.ts");
test("reminders only fire when due and not already shown", () => {
  const base = { id: "r1", babyId: "default", label: "Pompa", at: 100 };
  assert.equal(dueReminders([base], 99).length, 0);
  assert.equal(dueReminders([base], 100).length, 1);
  assert.equal(dueReminders([{ ...base, firedAt: 100 }], 1000).length, 0);
  assert.equal(dueReminders([{ ...base, firedAt: 0 }], 1000).length, 0);
  assert.equal(dueReminders([{ ...base, at: NaN }], 1000).length, 0);
});

test("reminder delivery persists once, waits for foreground and stops on downgrade", async () => {
  const store = await import("./store.ts");
  let tick: () => void = () => {};
  let listener: () => void = () => {};
  let stopped = false;
  const realInterval = globalThis.setInterval, realClear = globalThis.clearInterval;
  const documentMock = { visibilityState: "hidden", addEventListener: (_: string, fn: () => void) => { listener = fn; }, removeEventListener: () => { stopped = true; } };
  Object.assign(globalThis, { document: documentMock, window: {} });
  globalThis.setInterval = ((fn: () => void) => { tick = fn; return 1; }) as any;
  globalThis.clearInterval = (() => {}) as any;
  try {
    store.setPlusAccess(true);
    store.setPrefs({ reminders: [{ id: "due", babyId: "default", label: "Pompa", at: 1 }] });
    const stop = startReminders();
    assert.equal(store.getPrefs().reminders![0].firedAt, undefined);
    documentMock.visibilityState = "visible"; listener();
    const delivered = store.getPrefs().reminders![0].firedAt;
    assert.ok(delivered);
    tick();
    assert.equal(store.getPrefs().reminders![0].firedAt, delivered);
    assert.equal(JSON.parse(storage.get("bb_prefs_v1")!).reminders[0].firedAt, delivered, "reload preserves delivery");
    store.setPrefs({ reminders: [{ id: "later", babyId: "default", label: "Vitamin", at: 1 }] });
    store.setPlusAccess(false); tick();
    assert.equal(store.getPrefs().reminders![0].firedAt, undefined);
    stop(); assert.equal(stopped, true);
  } finally { globalThis.setInterval = realInterval; globalThis.clearInterval = realClear; }
});
