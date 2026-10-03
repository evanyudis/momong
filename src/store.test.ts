import assert from "node:assert/strict";
import { test } from "node:test";

// Minimal localStorage so the store module can load under node.
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};
const s = await import("./store.ts");

test("local edits queue for push and clear only when unchanged", () => {
  const r = s.put("kicks", { at: Date.now(), count: 1 });
  const [p] = s.pending();
  assert.equal(p.id, r.id);
  s.put("kicks", { id: r.id, count: 2 }); // edited while "in flight"
  s.markPushed([p]);
  assert.equal(s.pending().length, 1, "newer local edit stays queued");
  s.markPushed(s.pending());
  assert.equal(s.pending().length, 0);
});

test("remote merge is last-write-wins, tombstones hide records", () => {
  const r = s.put("symptoms", { at: Date.now(), name: "Mual" });
  s.markPushed(s.pending());
  s.applyRemote([{ collection: "symptoms", id: r.id, data: { name: "Lama" }, deleted: false, updatedAt: r.updatedAt - 1 }]);
  assert.equal(s.get("symptoms", r.id)?.name, "Mual", "older remote loses");
  s.applyRemote([{ collection: "symptoms", id: r.id, data: null, deleted: true, updatedAt: r.updatedAt + 1 }]);
  assert.equal(s.get("symptoms", r.id), undefined, "newer tombstone wins");
});

test("Free 30-day window hides old ASI/pump/diaper but not bottle", () => {
  const old = Date.now() - s.FREE_WINDOW_MS - 1000;
  s.put("diaper", { at: old, type: "pee" });
  s.put("bottle", { at: old, ml: 90 });
  assert.equal(s.list("diaper").length, 0);
  assert.equal(s.list("bottle").length, 1);
});
