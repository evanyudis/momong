import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createServer, type ViteDevServer } from "vite";

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

const memory = new Map<string, string>();
let server: ViteDevServer;
let sync: {
  authEmail: (mode: "daftar" | "masuk", email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setSyncEnabled: (enabled: boolean) => void;
  syncNow: () => Promise<void>;
};
let store: {
  put: (col: string, rec: { id: string; ml?: number }) => { ownerId?: string };
  get: (col: string, id: string) => { ownerId?: string; ml?: number } | undefined;
  pending: () => { id: string }[];
  setRecordOwner: (userId: string | null) => void;
  resetDeviceData: () => void;
  restoreBackup: (backup: { data: unknown; preferences: unknown; records: number }) => void;
  parseBackup: (text: string) => { data: unknown; preferences: unknown; records: number };
};
let me = account("new-user");
const syncBodies: { changes?: { id: string }[] }[] = [];

function markFlow() {
  memory.set("bb_pending_invite_flow", String(Date.now()));
}

async function reset() {
  await sync.signOut();
  store.resetDeviceData();
  store.setRecordOwner(null);
}

describe("same-flow guest notes", { concurrency: false }, () => {
  before(async () => {
    const storage = memoryStorage(memory);
    Object.assign(globalThis, { localStorage: storage, sessionStorage: storage });
    Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
    server = await createServer({ server: { middlewareMode: true }, define: { "import.meta.env.VITE_API_URL": JSON.stringify("http://test.local") } });
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const path = new URL(String(url)).pathname;
      if (path === "/sync") {
        syncBodies.push(JSON.parse(String(init?.body ?? "{}")));
        return Response.json({ cursor: syncBodies.length, changes: [] });
      }
      if (path === "/api/auth/sign-up/email" || path === "/api/auth/sign-in/email") return Response.json({ token: `session-${me.user.id}` });
      if (path === "/api/auth/sign-out") return Response.json({ ok: true });
      if (path === "/me") return Response.json(me);
      return Response.json({ ok: true });
    }) as typeof fetch;
    sync = await server.ssrLoadModule("/src/sync.ts");
    store = await server.ssrLoadModule("/src/store.ts");
  });

  after(async () => {
    await server.close();
  });

  test("guest notes are tagged to the account that signs up in the same flow", async () => {
    await reset();
    me = account("new-user");
    const note = store.put("bottle", { id: "guest-signup", ml: 40 });
    assert.equal(note.ownerId, "anon");
    markFlow();
    await sync.authEmail("daftar", "new-user@example.com", "password123");
    assert.equal(store.get("bottle", "guest-signup")?.ownerId, "new-user");
    assert.equal(store.pending().some((change) => change.id === "guest-signup"), true);
    assert.equal(memory.has("bb_pending_invite_flow"), false);
  });

  test("guest notes are tagged to an existing account that logs in during the same flow", async () => {
    await reset();
    me = account("existing");
    await sync.authEmail("masuk", "existing@example.com", "password123");
    store.put("bottle", { id: "note-existing", ml: 10 });
    await sync.signOut();
    store.setRecordOwner(null);
    const guest = store.put("bottle", { id: "guest-login", ml: 20 });
    assert.equal(guest.ownerId, "anon");
    markFlow();
    await sync.authEmail("masuk", "existing@example.com", "password123");
    assert.equal(store.get("bottle", "note-existing")?.ml, 10);
    assert.equal(store.get("bottle", "guest-login")?.ownerId, "existing");
    assert.equal(store.pending().some((change) => change.id === "guest-login"), true);
    assert.equal(memory.has("bb_pending_invite_flow"), false);
  });

  test("an account signing in outside the flow does not claim anon notes", async () => {
    await reset();
    me = account("outsider");
    store.put("bottle", { id: "guest-outside", ml: 30 });
    await sync.authEmail("masuk", "outsider@example.com", "password123");
    assert.equal(store.get("bottle", "guest-outside")?.ownerId, "anon");
    assert.equal(store.pending().some((change) => change.id === "guest-outside"), false);

    await reset();
    me = account("first");
    store.put("bottle", { id: "guest-first", ml: 31 });
    markFlow();
    await sync.authEmail("daftar", "first@example.com", "password123");
    assert.equal(memory.has("bb_pending_invite_flow"), false, "the first sign-in consumes the marker");
    assert.equal(store.get("bottle", "guest-first")?.ownerId, "first");
    await sync.signOut();
    store.setRecordOwner(null);
    const later = store.put("bottle", { id: "guest-later", ml: 32 });
    assert.equal(later.ownerId, "anon");
    me = account("second");
    await sync.authEmail("masuk", "second@example.com", "password123");
    assert.equal(store.pending().some((change) => change.id === "guest-later" || change.id === "guest-first"), false);
    const parked = JSON.parse(memory.get("bb_user_bundle:first") ?? "{}");
    assert.equal(parked.db.bottle["guest-later"].ownerId, "anon");
    assert.equal(parked.db.bottle["guest-first"].ownerId, "first");
  });

  test("untagged legacy notes are not claimed or uploaded", async () => {
    await reset();
    syncBodies.length = 0;
    store.restoreBackup(store.parseBackup(JSON.stringify({
      app: "Momong",
      data: { bottle: { legacy: { id: "legacy", updatedAt: 1, ml: 10 } } },
    })));
    assert.equal(store.get("bottle", "legacy")?.ownerId, undefined);
    markFlow();
    me = account("legacy-user");
    await sync.authEmail("masuk", "legacy-user@example.com", "password123");
    assert.equal(store.get("bottle", "legacy")?.ownerId, undefined);
    assert.equal(store.get("bottle", "legacy")?.ml, 10);
    assert.equal(store.pending().some((change) => change.id === "legacy"), false);
    const mark = syncBodies.length;
    sync.setSyncEnabled(true);
    await sync.syncNow();
    const uploaded = syncBodies.slice(mark).flatMap((body) => body.changes ?? []);
    assert.equal(uploaded.some((change) => change.id === "legacy"), false);
  });
});
