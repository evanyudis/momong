import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";
import type { Me } from "./sync.ts";

const memory = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    get length() { return memory.size; },
    key: (i: number) => [...memory.keys()][i] ?? null,
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  },
});

const { partnerSyncScreen, seatNameFromMember, seatNames } = await import("./household.ts");

test("pasangan sync prompt follows the local flag or cursor, not /me", () => {
  assert.equal(partnerSyncScreen({ hasToken: false, userId: null, enabledFlag: null, syncCursor: 0 }), "signin");
  assert.equal(partnerSyncScreen({ hasToken: true, userId: null, enabledFlag: null, syncCursor: 0 }), "wait");
  assert.equal(partnerSyncScreen({ hasToken: true, userId: "u1", enabledFlag: true, syncCursor: 0 }), "household");
  assert.equal(partnerSyncScreen({ hasToken: true, userId: "u1", enabledFlag: false, syncCursor: 0 }), "consent");
  assert.equal(partnerSyncScreen({ hasToken: true, userId: "u1", enabledFlag: false, syncCursor: 4 }), "household");
  assert.equal(partnerSyncScreen({ hasToken: true, userId: "u1", enabledFlag: null, syncCursor: 2 }), "household");
  assert.equal(partnerSyncScreen({ hasToken: true, userId: "u1", enabledFlag: null, syncCursor: 0 }), "consent");
});
const store = await import("./store.ts");

const googleOwner = "Adit Google";
const editedOwner = "Sari Melati";

function household(ownerName: string, selfName = "Dita"): Me {
  return {
    user: { id: "member", email: "dita@example.com", name: selfName },
    entitlement: { plan: "free", expiresAt: null },
    household: {
      id: "h1",
      seats: 2,
      members: [
        { id: "owner", email: "adit@gmail.com", name: ownerName, role: "owner" },
        { id: "member", email: "dita@example.com", name: selfName, role: "member" },
      ],
    },
  };
}

test("seat list name comes from the live household member, not local prefs", () => {
  store.setPrefs({ name: "Nama di HP ini" });
  assert.equal(seatNames(household(editedOwner)).partner, editedOwner);
  assert.notEqual(seatNames(household(editedOwner)).partner, store.getPrefs().name);
  assert.equal(seatNames(household(googleOwner)).partner, googleOwner, "account name is shown only as the member name on /me");
  assert.equal(seatNameFromMember({ name: "  ", email: "adit@gmail.com" }), "Adit");
  assert.equal(seatNameFromMember({ name: "  ", email: "adit@gmail.com" }), seatNames(household("  ")).partner);
  assert.notEqual(seatNames(household("  ")).partner, store.getPrefs().name);
  assert.equal(seatNameFromMember(null), "");
});

test("refresh replaces a cached Google name, and a saved name is what the seat list reads", async () => {
  memory.set("bb_token", "test-session");
  memory.set("bb_me", JSON.stringify(household(googleOwner)));
  const server = await createServer({ server: { middlewareMode: true }, define: { "import.meta.env.VITE_API_URL": JSON.stringify("http://test.local") } });
  const realFetch = globalThis.fetch;
  const posts: { path: string; body: unknown }[] = [];
  const names = new Map([["owner", editedOwner], ["member", "Dita"]]);
  const me = () => household(names.get("owner")!, names.get("member")!);
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    if (init?.method === "POST") posts.push({ path, body: JSON.parse(String(init.body ?? "null")) });
    if (path === "/api/auth/update-user") {
      const body = JSON.parse(String(init?.body)) as { name?: string };
      if (!body.name?.trim()) return Response.json({ message: "No fields to update" }, { status: 400 });
      names.set("member", body.name.trim());
      return Response.json({ status: true });
    }
    if (path === "/me") return Response.json(me());
    return Response.json({ ok: true });
  }) as typeof fetch;
  try {
    const sync = await server.ssrLoadModule("/src/sync.ts");
    const householdMod = await server.ssrLoadModule("/src/household.ts");
    assert.equal(householdMod.seatNames(sync.account().me).partner, googleOwner, "cached /me still has the Google name");
    await sync.refreshMe();
    assert.equal(householdMod.seatNames(sync.account().me).partner, editedOwner, "seat list reads the refreshed member");
    assert.equal(JSON.parse(memory.get("bb_me")!).household.members[0].name, editedOwner);

    const before = posts.length;
    await sync.updateDisplayName("   ");
    await sync.updateDisplayName("Dita");
    assert.equal(posts.length, before, "blank or unchanged name does not replace the account name");
    assert.equal(householdMod.seatNames(sync.account().me).self, "Dita");

    await sync.updateDisplayName("  Bunda Dita  ");
    assert.equal(posts.at(-1).path, "/api/auth/update-user");
    assert.deepEqual(posts.at(-1).body, { name: "Bunda Dita" });
    assert.equal(sync.account().me.user.name, "Bunda Dita");
    assert.equal(sync.account().me.household.members.find((m: { id: string }) => m.id === "member").name, "Bunda Dita");
    assert.equal(householdMod.seatNames(sync.account().me).self, "Bunda Dita");
    assert.equal(householdMod.seatNames(sync.account().me).partner, editedOwner);
  } finally {
    globalThis.fetch = realFetch;
    await server.close();
  }
});

test("restore keeps sync when the cursor is the only local evidence", async () => {
  const previousLocal = globalThis.localStorage;
  const previousSession = globalThis.sessionStorage;
  const memory = new Map<string, string>();
  const storage = {
    get length() { return memory.size; },
    key: (i: number) => [...memory.keys()][i] ?? null,
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  };
  const me = {
    user: { id: "qa-a", email: "qa-a@example.com", name: "Qa A" },
    entitlement: { plan: "free", expiresAt: null },
    household: {
      id: "house-1",
      seats: 2,
      members: [
        { id: "owner", email: "owner@example.com", name: "Owner", role: "owner" },
        { id: "qa-a", email: "qa-a@example.com", name: "Qa A", role: "member" },
      ],
    },
  };
  memory.set("bb_token", "test-token");
  memory.set("bb_me", JSON.stringify(me));
  memory.set("bb_cursor", "4");
  Object.assign(globalThis, { localStorage: storage, sessionStorage: storage });
  const server = await createServer({ server: { middlewareMode: true }, define: { "import.meta.env.VITE_API_URL": JSON.stringify("http://test.local") } });
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    const path = new URL(url).pathname;
    if (path === "/me") return Response.json(me);
    if (path === "/sync") return Response.json({ cursor: 4, changes: [] });
    return Response.json({ ok: true });
  }) as typeof fetch;
  try {
    const sync = await server.ssrLoadModule("/src/sync.ts");
    assert.equal(sync.account().syncEnabled, true);
    await sync.restoreAccount();
    assert.equal(sync.account().syncEnabled, true, "a full pull does not turn a synced account off");
    assert.equal(partnerSyncScreen({
      hasToken: true,
      userId: "qa-a",
      enabledFlag: sync.account().syncEnabled ? true : null,
      syncCursor: Number(memory.get("bb_cursor") ?? 0),
    }), "household");
  } finally {
    globalThis.fetch = realFetch;
    Object.assign(globalThis, { localStorage: previousLocal, sessionStorage: previousSession });
    await server.close();
  }
});
