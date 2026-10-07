import assert from "node:assert/strict";
import { test } from "node:test";

// Minimal localStorage so the store module can load under node.
const mem = new Map<string, string>();
const storage = {
  get length() { return mem.size; },
  key: (i: number) => [...mem.keys()][i] ?? null,
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};
Object.assign(globalThis, { localStorage: storage, sessionStorage: storage });
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

test("hasHidden is true only while the Free window hides a thin entry", () => {
  for (const col of s.THIN) s.list(col, 0).forEach((r) => s.remove(col, r.id)); // clean slate
  const old = Date.now() - s.FREE_WINDOW_MS - 1000;
  s.put("bottle", { at: old, ml: 90 });
  assert.equal(s.hasHidden(), false, "old bottle is never hidden");
  const d = s.put("diaper", { at: old, type: "pee" });
  assert.equal(s.hasHidden(), true);
  s.remove("diaper", d.id);
  assert.equal(s.hasHidden(), false, "tombstones do not count");
});

test("Plus history and baby profiles isolate records, preserve legacy data and survive downgrade", () => {
  const old = Date.now() - s.FREE_WINDOW_MS - 1000;
  s.put("pump", { id: "plus-old", at: old, ml: 40 });
  assert.ok(!s.list("pump").some((r) => r.id === "plus-old"));
  s.setPlusAccess(true);
  assert.ok(s.list("pump").some((r) => r.id === "plus-old"));
  s.saveSettings({ birthMode: "postpartum", babyName: "Nara", babyBirth: "2026-10-01" });
  s.put("bag", { id: "diapers", checked: true });
  assert.equal(s.addBaby({ babyName: "Dara", babyBirth: "2026-10-02", birthMode: "postpartum" }), true);
  assert.equal(s.settings().babyName, "Dara");
  assert.equal(s.list("pump").length, 0);
  assert.equal(s.get("bag", "diapers"), undefined);
  s.put("bag", { id: "diapers", checked: false });
  const custom = s.put("bag", { custom: true, label: "Selimut", checked: false });
  s.put("bag", { id: custom.id, checked: true });
  assert.equal(s.list("bag").filter((r) => r.custom).length, 1);
  assert.equal(s.get("bag", custom.id)?.checked, true);
  s.put("pump", { id: "second-pump", at: Date.now(), ml: 60 });
  const second = s.activeBabyId();
  s.saveSettings({ hpl: "2026-11-12", birthMode: "pregnant" });
  assert.equal(s.settings().hpl, "2026-11-12");
  s.saveSettings({ birthMode: "postpartum" });
  assert.equal(s.settings().hpl, "2026-11-12", "mode changes preserve HPL");
  assert.equal(s.settings().babyName, "Dara");
  s.setPrefs({ activeBabyId: "default" });
  assert.equal(s.get("bag", "diapers")?.checked, true);
  assert.ok(!s.list("pump").some((r) => r.id === "second-pump"));
  s.setPrefs({ activeBabyId: second });
  s.setPlusAccess(false);
  assert.equal(s.activeBabyId(), "default");
  assert.equal(s.settings().babyName, "Nara");
  assert.ok(!s.pending().some((r) => r.id === "second-pump" || r.collection === "baby"));
  s.setPlusAccess(true);
  assert.equal(s.activeBabyId(), second);
  assert.ok(s.list("pump").some((r) => r.id === "second-pump"));
  assert.ok(s.pending().some((r) => r.id === "second-pump"));
});

test("device reset clears all Momong state without tombstones or upload notifications", () => {
  s.setPrefs({ theme: "dark", guest: true, name: "Sari" });
  mem.set("bb_payment:user", "order"); mem.set("bb_auth_return", "#/plus"); mem.set("unrelated", "keep");
  let uploads = 0;
  const unsubscribe = s.onLocalChange(() => uploads++);
  s.resetDeviceData(); unsubscribe();
  assert.deepEqual(s.settings(), {});
  assert.deepEqual(s.getPrefs(), {});
  assert.deepEqual(s.pending(), []);
  assert.deepEqual(JSON.parse(s.exportJSON()).data, {});
  assert.equal(s.isPlus(), false);
  assert.equal(uploads, 0);
  assert.deepEqual([...mem.entries()], [["unrelated", "keep"]]);
});

test("backup restores legacy and Momong data without account state or uploads", () => {
  s.resetDeviceData();
  const legacy = s.parseBackup(JSON.stringify({ app: "BumpBuddy", data: { settings: { main: { id: "main", updatedAt: 1, hpl: "2027-01-01" } } } }));
  assert.deepEqual(legacy.preferences, {});
  s.restoreBackup(legacy);
  assert.equal(s.settings().hpl, "2027-01-01");
  assert.equal(s.getPrefs().guest, true);
  assert.equal(s.pending().length, 1);
  assert.throws(() => s.restoreBackup(legacy), /sudah berisi/);
  s.resetDeviceData();
  mem.set("bb_token", "session");
  assert.throws(() => s.restoreBackup(legacy), /Keluar akun/);
  mem.delete("bb_token");
  const backup = s.parseBackup(JSON.stringify({ app: "Momong", version: 2, data: legacy.data,
    preferences: { theme: "dark", token: "secret", notifyReminders: true, reminders: [{ id: "r", babyId: "default", label: "Pompa", at: 1, firedAt: 2 }] } }));
  assert.equal((backup.preferences as any).token, undefined);
  assert.equal(backup.preferences.notifyReminders, undefined);
  let uploads = 0; const off = s.onLocalChange(() => uploads++);
  s.restoreBackup(backup); off();
  assert.equal(uploads, 0);
  assert.equal(s.getPrefs().reminders?.[0].firedAt, 2);
  assert.equal(s.isPlus(), false);
});
test("backup rejects invalid payloads and rolls back quota failure", () => {
  s.resetDeviceData();
  assert.throws(() => s.parseBackup("{"), /JSON/);
  assert.throws(() => s.parseBackup(JSON.stringify({ app: "Momong", data: { unknown: {} } })), /Koleksi/);
  assert.throws(() => s.parseBackup(JSON.stringify({ app: "Momong", data: { kicks: { a: { id: "b", updatedAt: 1 } } } })), /Catatan/);
  assert.throws(() => s.parseBackup(" ".repeat(5 * 1024 * 1024 + 1)), /besar/);
  const backup = s.parseBackup(JSON.stringify({ app: "Momong", data: { kicks: { a: { id: "a", updatedAt: 1, count: 1 } } } }));
  const original = storage.setItem; let writes = 0;
  storage.setItem = (k, v) => { if (++writes === 2) throw new Error("quota"); original(k, v); };
  try { assert.throws(() => s.restoreBackup(backup), /penuh/); } finally { storage.setItem = original; }
  assert.equal(s.deviceHasData(), false);
  assert.equal(mem.has("bb_db_v1"), false);
  assert.deepEqual(s.getPrefs(), {});
});


test("failed persistence does not show unsaved records or preferences, and retry saves once", () => {
  const before = s.list("bottle").length;
  const prefs = s.getPrefs();
  const original = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === "bb_db_v1" || key === "bb_prefs_v1") throw new Error("Storage full");
    original(key, value);
  };
  try {
    assert.throws(() => s.put("bottle", { id: "failed-save", at: Date.now(), ml: 90 }));
    assert.equal(s.list("bottle").length, before);
    assert.equal(s.get("bottle", "failed-save"), undefined);
    assert.throws(() => s.setPrefs({ name: "Unsaved name" }));
    assert.deepEqual(s.getPrefs(), prefs);
  } finally { storage.setItem = original; }
  s.put("bottle", { id: "failed-save", at: Date.now(), ml: 90 });
  assert.equal(s.list("bottle").length, before + 1);
  assert.equal(s.pending().filter((r) => r.id === "failed-save").length, 1);
});
