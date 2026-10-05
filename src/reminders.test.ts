import assert from "node:assert/strict";
import { test } from "node:test";
(globalThis as any).addEventListener = () => {};
Object.defineProperty(globalThis, "localStorage", { value: { getItem: () => null }, configurable: true });
const { dueReminders } = await import("./reminders.ts");
test("reminders only fire when due and not already shown", () => {
  const base = { id: "r1", babyId: "default", label: "Pompa", at: 100 };
  assert.equal(dueReminders([base], 99).length, 0);
  assert.equal(dueReminders([base], 100).length, 1);
  assert.equal(dueReminders([{ ...base, firedAt: 100 }], 1000).length, 0);
});
