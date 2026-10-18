import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";
import { inviteEntry } from "./invite.ts";
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

const { householdHasPartner, partnerSyncScreen, seatNameFromMember, seatNames } = await import("./household.ts");

test("pasangan sync prompt follows the local flag, the cursor, or a partner already on /me", () => {
  assert.equal(partnerSyncScreen({ hasToken: false, userId: null, enabledFlag: null, syncCursor: 0 }), "signin");
  assert.equal(partnerSyncScreen({ hasToken: true, userId: null, enabledFlag: null, syncCursor: 0, paired: true, checking: true }), "wait");
  assert.equal(partnerSyncScreen({ hasToken: true, userId: "u1", enabledFlag: true, syncCursor: 0, checking: true }), "household");
  assert.equal(partnerSyncScreen({ hasToken: true, userId: "u1", enabledFlag: false, syncCursor: 0 }), "consent");
  assert.equal(partnerSyncScreen({ hasToken: true, userId: "u1", enabledFlag: false, syncCursor: 4, checking: true }), "household");
  assert.equal(partnerSyncScreen({ hasToken: true, userId: "u1", enabledFlag: null, syncCursor: 2 }), "household");
  assert.equal(partnerSyncScreen({ hasToken: true, userId: "u1", enabledFlag: null, syncCursor: 0, checking: true }), "wait");
  assert.equal(partnerSyncScreen({ hasToken: true, userId: "u1", enabledFlag: null, syncCursor: 0, paired: true }), "household");
  assert.equal(partnerSyncScreen({ hasToken: true, userId: "u1", enabledFlag: null, syncCursor: 0 }), "consent");
  assert.equal(householdHasPartner(null), false);
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

test("a paired account on a fresh device leaves Gabung for Pasangan without the sync prompt", async () => {
  const previousLocal = globalThis.localStorage;
  const previousSession = globalThis.sessionStorage;
  const memory = new Map<string, string>();
  const me = {
    user: { id: "qa-fresh", email: "qa-fresh@example.com", name: "Qa Fresh" },
    entitlement: { plan: "free", expiresAt: null },
    household: {
      id: "house-fresh",
      seats: 2,
      members: [
        { id: "qa-fresh", email: "qa-fresh@example.com", name: "Qa Fresh", role: "owner" },
        { id: "partner", email: "partner@example.com", name: "Pasangan", role: "member" },
      ],
    },
  };
  memory.set("bb_token", "fresh-token");
  Object.assign(globalThis, { localStorage: storageFrom(memory), sessionStorage: storageFrom(memory) });
  Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
  const server = await createServer({ server: { middlewareMode: true }, define: { "import.meta.env.VITE_API_URL": JSON.stringify("http://test.local") } });
  const realFetch = globalThis.fetch;
  const syncs: unknown[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    if (path === "/me") return Response.json(me);
    if (path === "/sync") {
      syncs.push(init?.body ? JSON.parse(String(init.body)) : null);
      return Response.json({ cursor: 3, changes: [] });
    }
    return Response.json({ ok: true });
  }) as typeof fetch;
  try {
    assert.equal(memory.has("bb_sync_enabled:qa-fresh"), false);
    assert.equal(memory.has("bb_cursor"), false);
    assert.equal(inviteEntry({ signedIn: true, validInvite: true, hasPartner: householdHasPartner(me) }), "connected");
    const sync = await server.ssrLoadModule("/src/sync.ts");
    assert.equal(sync.account().syncEnabled, false, "a fresh device has not opted in locally");
    await sync.restoreAccount();
    assert.equal(sync.account().syncEnabled, true, "a second member on /me turns sync on");
    assert.equal(memory.get("bb_sync_enabled:qa-fresh"), "true");
    assert.ok(syncs.length >= 1, "the first sync runs");
    assert.equal(partnerSyncScreen({
      hasToken: true,
      userId: sync.account().me.user.id,
      enabledFlag: sync.account().syncEnabled ? true : null,
      syncCursor: Number(memory.get("bb_cursor") ?? 0),
      paired: householdHasPartner(sync.account().me),
      checking: !!sync.account().checking,
    }), "household");
  } finally {
    globalThis.fetch = realFetch;
    Object.assign(globalThis, { localStorage: previousLocal, sessionStorage: previousSession });
    await server.close();
  }
});

function storageFrom(memory: Map<string, string>) {
  return {
    get length() { return memory.size; },
    key: (i: number) => [...memory.keys()][i] ?? null,
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  };
}

test("sync stays on for the same account after logout and login", async () => {
  const previousLocal = globalThis.localStorage;
  const previousSession = globalThis.sessionStorage;
  const memory = new Map<string, string>();
  const me = {
    user: { id: "qa-a", email: "qa-a@example.com", name: "Qa A" },
    entitlement: { plan: "free", expiresAt: null },
    household: { id: "house-1", seats: 2, members: [{ id: "qa-a", email: "qa-a@example.com", name: "Qa A", role: "owner" }] },
  };
  memory.set("bb_token", "test-token");
  memory.set("bb_me", JSON.stringify(me));
  memory.set("bb_cursor", "4");
  Object.assign(globalThis, { localStorage: storageFrom(memory), sessionStorage: storageFrom(memory) });
  Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
  const server = await createServer({ server: { middlewareMode: true }, define: { "import.meta.env.VITE_API_URL": JSON.stringify("http://test.local") } });
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    const path = new URL(url).pathname;
    if (path === "/api/auth/sign-in/email") return Response.json({ token: "again" });
    if (path === "/me") return Response.json(me);
    if (path === "/sync") return Response.json({ cursor: 4, changes: [] });
    return Response.json({ ok: true });
  }) as typeof fetch;
  try {
    const sync = await server.ssrLoadModule("/src/sync.ts");
    assert.equal(sync.account().syncEnabled, true);
    await sync.signOut();
    assert.equal(memory.get("bb_sync_enabled:qa-a"), "true", "logout keeps the per-account sync flag");
    assert.equal(memory.has("bb_cursor"), false);
    await sync.authEmail("masuk", "qa-a@example.com", "test-password");
    assert.equal(sync.account().syncEnabled, true, "logging back in restores sync");
    assert.equal(partnerSyncScreen({
      hasToken: true,
      userId: "qa-a",
      enabledFlag: memory.get("bb_sync_enabled:qa-a") === "true",
      syncCursor: Number(memory.get("bb_cursor") ?? 0),
    }), "household");
  } finally {
    globalThis.fetch = realFetch;
    Object.assign(globalThis, { localStorage: previousLocal, sessionStorage: previousSession });
    await server.close();
  }
});

test("wipe clears profile, sync, invite, and browser caches; another account does not inherit the profile", async () => {
  const previousLocal = globalThis.localStorage;
  const previousSession = globalThis.sessionStorage;
  const memory = new Map<string, string>();
  Object.assign(globalThis, { localStorage: storageFrom(memory), sessionStorage: storageFrom(memory) });
  Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
  const deleted: string[] = [];
  (globalThis as { caches?: unknown }).caches = {
    keys: async () => ["bb-shell"],
    delete: async (key: string) => { deleted.push(key); return true; },
  };
  (globalThis as { indexedDB?: unknown }).indexedDB = {
    databases: async () => [{ name: "momong-local" }],
    deleteDatabase: (name: string) => { deleted.push(name); },
  };
  const server = await createServer({ server: { middlewareMode: true }, define: { "import.meta.env.VITE_API_URL": JSON.stringify("http://test.local") } });
  const realFetch = globalThis.fetch;
  const qaD = {
    user: { id: "qa-d", email: "qa-d@example.com", name: "Qa D" },
    entitlement: { plan: "free", expiresAt: null },
    household: { id: "house-d", seats: 2, members: [{ id: "qa-d", email: "qa-d@example.com", name: "Qa D", role: "owner" }] },
  };
  globalThis.fetch = (async (url: string) => {
    const path = new URL(url).pathname;
    if (path === "/api/auth/sign-in/email") return Response.json({ token: "d-session" });
    if (path === "/me") return Response.json(qaD);
    if (path === "/sync") return Response.json({ cursor: 1, changes: [] });
    return Response.json({ ok: true });
  }) as typeof fetch;
  try {
    const store = await server.ssrLoadModule("/src/store.ts");
    const sync = await server.ssrLoadModule("/src/sync.ts");
    store.saveSettings({ birthMode: "postpartum", babyName: "Bayi A", babyBirth: "2026-10-01" });
    memory.set("bb_data_user", "qa-a");
    memory.set("bb_sync_enabled:qa-a", "true");
    memory.set("bb_sync_enabled:qa-d", "true");
    memory.set("bb_cursor", "3");
    memory.set("bb_pending_invite", "inviteTok1");
    memory.set("bb_pending_invite_at", String(Date.now()));
    assert.equal(sync.resetGuestData(), true);
    assert.equal(store.settings().babyName, undefined);
    assert.equal(store.settings().birthMode, undefined);
    assert.equal(memory.has("bb_sync_enabled:qa-a"), false);
    assert.equal(memory.has("bb_cursor"), false);
    assert.equal(memory.has("bb_pending_invite"), false);
    assert.equal(memory.has("bb_db_v1"), false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(deleted.includes("bb-shell"));
    assert.ok(deleted.includes("momong-local"));

    store.saveSettings({ birthMode: "postpartum", babyName: "Bayi A", babyBirth: "2026-10-01" });
    memory.set("bb_data_user", "qa-a");
    memory.set("bb_sync_enabled:qa-a", "true");
    await sync.authEmail("masuk", "qa-d@example.com", "test-password");
    assert.notEqual(store.settings().babyName, "Bayi A");
    assert.equal(memory.get("bb_sync_enabled:qa-a"), "true", "the other account's sync flag stays");
    assert.equal(memory.get("bb_data_user"), "qa-d");
  } finally {
    globalThis.fetch = realFetch;
    Object.assign(globalThis, { localStorage: previousLocal, sessionStorage: previousSession });
    await server.close();
  }
});
