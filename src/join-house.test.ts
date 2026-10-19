import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";

test("joining keeps the house baby and leaves the joiner's note in the open database", async () => {
  const memory = new Map<string, string>();
  const storage = {
    get length() { return memory.size; },
    key: (i: number) => [...memory.keys()][i] ?? null,
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  };
  const loc = { hash: "#/gabung?invite=inviteTok1", replace(next: string) { this.hash = next; } };
  Object.assign(globalThis, { localStorage: storage, sessionStorage: storage, location: loc });
  Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
  const server = await createServer({ server: { middlewareMode: true }, define: { "import.meta.env.VITE_API_URL": JSON.stringify("http://test.local") } });
  const realFetch = globalThis.fetch;
  const syncBodies: { changes?: { collection: string; id: string; data?: { babyName?: string; note?: string } }[] }[] = [];
  let joined = false;
  const solo = {
    user: { id: "Q", email: "q@example.com", name: "qa-q" },
    entitlement: { plan: "free", expiresAt: null },
    household: { id: "house-q", seats: 2, members: [{ id: "Q", email: "q@example.com", name: "qa-q", role: "owner" }] },
  };
  const paired = {
    user: solo.user,
    entitlement: solo.entitlement,
    household: {
      id: "house-p",
      seats: 2,
      members: [
        { id: "P", email: "p@example.com", name: "qa-p", role: "owner" },
        { id: "Q", email: "q@example.com", name: "qa-q", role: "member" },
      ],
    },
  };
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (path === "/api/auth/sign-in/email") return Response.json({ token: "session-q" });
    if (path === "/api/auth/sign-out") return Response.json({ ok: true });
    if (path === "/me") return Response.json(joined ? paired : solo);
    if (path === "/household/join") {
      joined = true;
      return Response.json({ ok: true, householdId: "house-p" });
    }
    if (path === "/sync") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      syncBodies.push(body);
      const changes = joined ? [{
        collection: "settings",
        id: "main",
        data: { birthMode: "postpartum", babyName: "Bayi P", babyBirth: "2026-01-01" },
        deleted: false,
        updatedAt: Date.now(),
        updatedBy: "P",
      }] : [];
      return Response.json({ cursor: syncBodies.length, changes });
    }
    return Response.json({ ok: true });
  }) as typeof fetch;
  try {
    const sync = await server.ssrLoadModule("/src/sync.ts");
    const store = await server.ssrLoadModule("/src/store.ts");
    await sync.authEmail("masuk", "q@example.com", "password123");
    store.saveSettings({ birthMode: "postpartum", babyName: "Bayi Q", babyBirth: "2026-02-02" });
    store.put("bottle", { id: "catatan-s", at: Date.now(), ml: 40, note: "catatan S" });
    assert.equal(store.get("settings", "main").ownerId, "Q");
    await sync.acceptInvite("inviteTok1");

    const uploaded = syncBodies.flatMap((body) => body.changes ?? []);
    assert.equal(uploaded.some((change) => change.collection === "settings" && change.data?.babyName === "Bayi Q"), false, "the joiner's baby is not uploaded into the house");
    assert.equal(uploaded.some((change) => change.collection === "baby"), false);
    assert.equal(store.settings().babyName, "Bayi P", "the house profile wins on this phone");
    const parked = store.readParkedProfile("Q");
    assert.equal(parked?.settings?.main?.babyName, "Bayi Q", "the joiner's profile stays on the device");
    assert.equal(parked?.baby && Object.keys(parked.baby).length, 0);
    assert.equal(JSON.parse(memory.get("bb_prejoin_profile:Q")).settings.main.babyName, "Bayi Q");

    const note = store.get("bottle", "catatan-s");
    assert.equal(note?.note, "catatan S");
    assert.equal(note?.ownerId, "Q");
    assert.equal(!!note?.deleted, false);
    const openDb = JSON.parse(memory.get("bb_db_v1"));
    assert.equal(openDb.bottle["catatan-s"].note, "catatan S", "the note stays in the open database");
    assert.equal(JSON.parse(memory.get("bb_prejoin_profile:Q")).bottle, undefined, "the note is not moved into the parked profile");
    assert.equal(uploaded.some((change) => change.id === "catatan-s"), true, "an owned log row is still sent with the join sync");
  } finally {
    globalThis.fetch = realFetch;
    await server.close();
  }
});
