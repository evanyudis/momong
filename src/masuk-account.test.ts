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

test("Masuk accepts a different account than the one that last used this device", async () => {
  const memory = new Map<string, string>();
  const previous = {
    user: { id: "I", email: "qa.vansken.i+1018@example.com", name: "I" },
    entitlement: { plan: "free", expiresAt: null },
    household: { id: "house-I", seats: 2, members: [{ id: "I", email: "qa.vansken.i+1018@example.com", name: "I", role: "owner" }] },
  };
  const next = {
    user: { id: "M", email: "qa.vansken.m+1018@example.com", name: "M" },
    entitlement: { plan: "free", expiresAt: null },
    household: { id: "house-M", seats: 2, members: [{ id: "M", email: "qa.vansken.m+1018@example.com", name: "M", role: "owner" }] },
  };
  memory.set("bb_token", "session-i");
  memory.set("bb_me", JSON.stringify(previous));
  memory.set("bb_data_user", "I");
  memory.set("bb_db_v1", JSON.stringify({ bottle: { "note-i": { id: "note-i", updatedAt: 1, ml: 30, ownerId: "I", deleted: false } } }));
  memory.set("bb_dirty_v1", JSON.stringify(["bottle/note-i"]));
  const storage = memoryStorage(memory);
  Object.assign(globalThis, { localStorage: storage, sessionStorage: storage });
  Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
  const server = await createServer({ server: { middlewareMode: true }, define: { "import.meta.env.VITE_API_URL": JSON.stringify("http://test.local") } });
  const realFetch = globalThis.fetch;
  const signIns: { authorization: string | null; email?: string }[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    const headers = new Headers(init?.headers);
    if (path === "/api/auth/sign-in/email") {
      signIns.push({ authorization: headers.get("authorization"), email: JSON.parse(String(init?.body ?? "{}")).email });
      return Response.json({ token: "session-m" });
    }
    if (path === "/me") return Response.json(next);
    if (path === "/sync") return Response.json({ cursor: 1, changes: [] });
    if (path === "/api/auth/sign-out") return Response.json({ ok: true });
    return Response.json({ ok: true });
  }) as typeof fetch;
  try {
    const sync = await server.ssrLoadModule("/src/sync.ts");
    const store = await server.ssrLoadModule("/src/store.ts");
    await sync.authEmail("masuk", "qa.vansken.m+1018@example.com", "password123");
    assert.equal(signIns.length, 1);
    assert.equal(signIns[0].authorization, null);
    assert.equal(signIns[0].email, "qa.vansken.m+1018@example.com");
    assert.equal(sync.account().token, "session-m");
    assert.equal(store.get("bottle", "note-i"), undefined);
    assert.equal(store.pending().some((change: { id: string }) => change.id === "note-i"), false);
    const parked = JSON.parse(memory.get("bb_user_bundle:I") ?? "{}");
    assert.equal(parked.db.bottle["note-i"].ml, 30);
    assert.equal(parked.db.bottle["note-i"].ownerId, "I");
  } finally {
    globalThis.fetch = realFetch;
    await server.close();
  }
});
