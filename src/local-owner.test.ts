import assert from "node:assert/strict";
import { test } from "node:test";

const mem = new Map<string, string>();
const storage = {
  get length() { return mem.size; },
  key: (i: number) => [...mem.keys()][i] ?? null,
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};
Object.assign(globalThis, { localStorage: storage, sessionStorage: storage });
const store = await import("./store.ts");

test("a solo account keeps its profile on the same device, and another account does not take it", () => {
  store.resetDeviceData();
  store.saveSettings({ birthMode: "postpartum", babyName: "Bayi I", babyBirth: "2026-10-01" });
  store.setPrefs({ name: "qa-d-1018" });
  store.put("bottle", { id: "note-d", ml: 40 });
  assert.equal(store.adoptLocalOwner("qa-d"), "claimed", "untagged notes stay and are stamped, not deleted");
  assert.equal(store.settings().babyName, "Bayi I");
  assert.equal(store.getPrefs().name, "qa-d-1018");
  assert.equal(store.get("bottle", "note-d")?.ml, 40);
  assert.equal(store.localOwner(), "qa-d");

  assert.equal(store.adoptLocalOwner("qa-d"), "kept");
  assert.equal(store.settings().babyName, "Bayi I");
  assert.equal(store.getPrefs().name, "qa-d-1018");

  assert.equal(store.adoptLocalOwner("qa-c"), "fresh");
  assert.equal(store.settings().babyName, undefined);
  assert.equal(store.getPrefs().name, undefined);
  assert.equal(store.get("bottle", "note-d"), undefined);
  const parked = JSON.parse(mem.get("bb_user_bundle:qa-d") ?? "{}");
  assert.equal(parked.prefs.name, "qa-d-1018");
  assert.equal(parked.db.settings.main.babyName, "Bayi I");
  assert.equal(parked.db.bottle["note-d"].ml, 40);

  assert.equal(store.adoptLocalOwner("qa-d"), "restored");
  assert.equal(store.settings().babyName, "Bayi I");
  assert.equal(store.getPrefs().name, "qa-d-1018");
  assert.equal(store.get("bottle", "note-d")?.ml, 40);
  assert.equal(store.get("bottle", "note-d")?.ownerId, "anon", "claiming a logged-out note does not tag it with the account");
  store.setRecordOwner("qa-d");
  assert.equal(store.pending().some((row) => row.id === "note-d"), false, "claiming a logged-out note does not make it uploadable");
});
