import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";

function memoryStorage(memory: Map<string, string>) {
  return {
    get length() { return memory.size; },
    key: (i: number) => [...memory.keys()][i] ?? null,
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  };
}

function account(id: string) {
  return {
    user: { id, email: `${id}@example.com`, name: id },
    entitlement: { plan: "free" as const, expiresAt: null },
    household: { id: `house-${id}`, seats: 2, members: [{ id, email: `${id}@example.com`, name: id, role: "owner" as const }] },
  };
}

function changeIds(bodies: { changes?: { id: string; data?: { ownerId?: string } }[] }[]) {
  return bodies.flatMap((body) => body.changes ?? []);
}

test("Aktifkan sinkron uploads only the signed-in account's own records", async () => {
  const memory = new Map<string, string>();
  const storage = memoryStorage(memory);
  Object.assign(globalThis, { localStorage: storage, sessionStorage: storage });
  Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
  const server = await createServer({ server: { middlewareMode: true }, define: { "import.meta.env.VITE_API_URL": JSON.stringify("http://test.local") } });
  const realFetch = globalThis.fetch;
  const syncBodies: { changes?: { id: string; data?: { ownerId?: string } }[] }[] = [];
  let me = account("A");
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (path === "/sync") {
      syncBodies.push(JSON.parse(String(init?.body ?? "{}")));
      return Response.json({ cursor: syncBodies.length, changes: [] });
    }
    if (path === "/api/auth/sign-in/email") return Response.json({ token: `session-${me.user.id}` });
    if (path === "/api/auth/sign-out") return Response.json({ ok: true });
    if (path === "/me") return Response.json(me);
    return Response.json({ ok: true });
  }) as typeof fetch;
  try {
    const sync = await server.ssrLoadModule("/src/sync.ts");
    const store = await server.ssrLoadModule("/src/store.ts");

    me = account("A");
    await sync.authEmail("masuk", "A@example.com", "password123");
    store.put("bottle", { id: "note-a", ml: 40 });
    assert.equal(store.get("bottle", "note-a").ownerId, "A");
    await sync.signOut();

    me = account("B");
    await sync.authEmail("masuk", "B@example.com", "password123");
    assert.equal(store.get("bottle", "note-a"), undefined, "B does not take A's notes onto this screen");
    const bMark = syncBodies.length;
    sync.setSyncEnabled(true);
    await sync.syncNow();
    const bChanges = changeIds(syncBodies.slice(bMark));
    assert.equal(bChanges.some((change) => change.id === "note-a"), false, "B's Aktifkan sinkron uploads none of A's notes");
    await sync.signOut();

    me = account("A");
    await sync.authEmail("masuk", "A@example.com", "password123");
    assert.equal(store.get("bottle", "note-a")?.ml, 40, "A's notes come back with A");
    const aMark = syncBodies.length;
    sync.setSyncEnabled(true);
    await sync.syncNow();
    const aChanges = changeIds(syncBodies.slice(aMark));
    assert.ok(aChanges.some((change) => change.id === "note-a"), "A's sync uploads A's note");
    assert.equal(aChanges.every((change) => change.id === "note-a"), true, "A's sync uploads only A's note");
    assert.equal(aChanges.every((change) => change.data?.ownerId === undefined), true, "the owner tag stays on the device");

    await sync.signOut();
    store.resetDeviceData();
    store.restoreBackup(store.parseBackup(JSON.stringify({
      app: "Momong",
      data: { bottle: { legacy: { id: "legacy", updatedAt: 1, ml: 10 } } },
    })));
    assert.equal(store.get("bottle", "legacy")?.ml, 10);
    assert.equal(store.get("bottle", "legacy")?.ownerId, undefined);
    me = account("C");
    await sync.authEmail("masuk", "C@example.com", "password123");
    assert.equal(store.get("bottle", "legacy")?.ml, 10, "an old untagged note stays on screen");
    assert.equal(store.get("bottle", "legacy")?.ownerId, undefined, "claiming it does not tag it with the account");
    const legacyMark = syncBodies.length;
    sync.setSyncEnabled(true);
    await sync.syncNow();
    assert.equal(changeIds(syncBodies.slice(legacyMark)).some((change) => change.id === "legacy"), false, "untagged notes are not uploaded");

    await sync.signOut();
    store.resetDeviceData();
    store.restoreBackup(store.parseBackup(JSON.stringify({
      app: "Momong",
      data: {
        bottle: {
          legacy: { id: "legacy", updatedAt: 1, ml: 10 },
          anon: { id: "anon", updatedAt: 1, ml: 11, ownerId: "anon" },
          other: { id: "other", updatedAt: 1, ml: 12, ownerId: "other" },
        },
      },
    })));
    me = account("D");
    await sync.authEmail("masuk", "D@example.com", "password123");
    store.put("bottle", { id: "mine", ml: 13 });
    store.put("bottle", { id: "anon", ml: 21 });
    const mixMark = syncBodies.length;
    sync.setSyncEnabled(true);
    await sync.syncNow();
    const mixIds = changeIds(syncBodies.slice(mixMark)).map((change) => change.id);
    assert.deepEqual([...new Set(mixIds)], ["mine"], "a mixed database uploads only this account's notes");
    assert.equal(store.get("bottle", "anon")?.ownerId, "anon");
    assert.equal(store.get("bottle", "anon")?.ml, 21, "editing an anon note does not retag it");
    assert.equal(store.get("bottle", "legacy")?.ownerId, undefined);
    assert.equal(store.get("bottle", "other")?.ownerId, "other");
    const newer = Date.now() + 10_000;
    store.applyRemote([
      { collection: "bottle", id: "other", data: { ml: 99 }, deleted: false, updatedAt: newer },
      { collection: "bottle", id: "legacy", data: { ml: 98 }, deleted: false, updatedAt: newer },
      { collection: "bottle", id: "anon", data: { ml: 97, ownerId: "D" }, deleted: false, updatedAt: newer },
    ]);
    assert.equal(store.get("bottle", "other")?.ml, 12);
    assert.equal(store.get("bottle", "other")?.ownerId, "other");
    assert.equal(store.get("bottle", "legacy")?.ml, 10);
    assert.equal(store.get("bottle", "legacy")?.ownerId, undefined);
    assert.equal(store.get("bottle", "anon")?.ml, 21);
    assert.equal(store.get("bottle", "anon")?.ownerId, "anon");
  } finally {
    globalThis.fetch = realFetch;
    await server.close();
  }
});
