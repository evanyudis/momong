import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createServer } from "vite";
import { canSubmit, deleteBody, deleteErrorCopy, parsePreview, type DeletionPreview } from "./delete-account";

function memoryStorage(memory: Map<string, string>) {
  return {
    get length() { return memory.size; },
    key: (i: number) => [...memory.keys()][i] ?? null,
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  };
}

const base: DeletionPreview = { hasPassword: true, sessionFresh: false, soleMember: true, hasPartner: false, plusActive: false, plusLossNeedsAck: false, blocked: null };

test("the delete button needs HAPUS, the right re-auth, and the Plus acknowledgement when Plus would be lost", () => {
  const form = { confirm: "hapus ", password: "rahasia", acknowledgePlusLoss: false };
  assert.equal(canSubmit(base, form), true);
  assert.equal(canSubmit(base, { ...form, confirm: "HAPU" }), false);
  assert.equal(canSubmit(base, { ...form, password: "" }), false);
  assert.equal(canSubmit({ ...base, hasPassword: false }, { ...form, password: "" }), false, "no password: stale login must sign in again");
  assert.equal(canSubmit({ ...base, hasPassword: false, sessionFresh: true }, { ...form, password: "" }), true);
  assert.equal(canSubmit({ ...base, plusActive: true, plusLossNeedsAck: true }, form), false);
  assert.equal(canSubmit({ ...base, plusActive: true, plusLossNeedsAck: true }, { ...form, acknowledgePlusLoss: true }), true);
  assert.equal(canSubmit({ ...base, blocked: "midtrans_autorenew_active" }, form), false);
  assert.deepEqual(deleteBody(base, form), { confirm: "hapus", password: "rahasia" });
  assert.deepEqual(deleteBody({ ...base, hasPassword: false, plusLossNeedsAck: true }, { ...form, acknowledgePlusLoss: true }), { confirm: "hapus", acknowledgePlusLoss: true });
});

test("preview parsing rejects odd payloads and every server refusal has its own copy", () => {
  assert.equal(parsePreview(null), null);
  assert.equal(parsePreview({ ...base, hasPassword: "yes" }), null);
  assert.deepEqual(parsePreview({ ...base, orders: 2, blocked: "x" }), base);
  const generic = deleteErrorCopy("");
  for (const code of ["invalid_password", "password_required", "confirm_required", "reauth_required", "rate_limited", "plus_loss_unacknowledged", "midtrans_autorenew_active"]) {
    assert.notEqual(deleteErrorCopy(code), generic, code);
  }
});

async function withSync(memory: Map<string, string>, respond: (path: string, init?: RequestInit) => Response, run: (sync: any, store: any) => Promise<void>) {
  const storage = memoryStorage(memory);
  Object.assign(globalThis, { localStorage: storage, sessionStorage: memoryStorage(new Map()) });
  Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
  const server = await createServer({ server: { middlewareMode: true }, logLevel: "silent", define: { "import.meta.env.VITE_API_URL": JSON.stringify("http://test.local") } });
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => respond(new URL(String(url)).pathname, init)) as typeof fetch;
  try { await run(await server.ssrLoadModule("/src/sync.ts"), await server.ssrLoadModule("/src/store.ts")); }
  finally { globalThis.fetch = realFetch; await server.close(); }
}

const me = { user: { id: "U", email: "u@example.com", name: "U" }, entitlement: { plan: "free", expiresAt: null }, household: { id: "H", seats: 2, members: [{ id: "U", email: "u@example.com", name: "U", role: "owner" }] } };
function signedIn() {
  return new Map<string, string>([
    ["bb_token", "session-u"], ["bb_me", JSON.stringify(me)], ["bb_data_user", "U"], ["bb_sync_enabled:U", "true"], ["bb_cursor", "9"],
    ["bb_db_v1", JSON.stringify({ kicks: { k1: { id: "k1", updatedAt: 1, ownerId: "U", deleted: false } } })],
  ]);
}

test("Hapus akun sends the confirmation with the bearer, then clears the session and wipes this phone", async () => {
  const memory = signedIn();
  const calls: { path: string; auth: string | null; body: any }[] = [];
  await withSync(memory, (path, init) => {
    calls.push({ path, auth: new Headers(init?.headers).get("authorization"), body: init?.body ? JSON.parse(String(init.body)) : null });
    if (path === "/account/deletion") return Response.json({ ...base, orders: 0 });
    if (path === "/account/delete") return Response.json({ ok: true, deletionId: "d1", householdDeleted: true });
    return Response.json({ ok: true });
  }, async (sync, store) => {
    assert.deepEqual(await sync.loadDeletionPreview(), base);
    await sync.deleteAccount({ confirm: "HAPUS", password: "rahasia" }, true);
    const del = calls.find((c) => c.path === "/account/delete")!;
    assert.equal(del.auth, "Bearer session-u");
    assert.deepEqual(del.body, { confirm: "HAPUS", password: "rahasia" });
    assert.equal(sync.account().token, null);
    assert.equal(sync.account().me, null);
    assert.equal(store.get("kicks", "k1"), undefined, "device notes wiped");
    assert.equal([...memory.keys()].filter((k) => k.startsWith("bb_") && k !== "bb_me" && k !== "bb_last_sync").length, 0, "no account keys left");
    assert.equal(calls.some((c) => c.path === "/api/auth/sign-out"), false, "server already dropped every session");
  });
});

test("keeping device data leaves the notes as local notes; a refusal keeps the account signed in", async () => {
  const memory = signedIn();
  let refuse = true;
  await withSync(memory, (path) => {
    if (path === "/account/delete") return refuse ? Response.json({ error: "invalid_password" }, { status: 403 }) : Response.json({ ok: true, deletionId: "d2" });
    return Response.json({ ok: true });
  }, async (sync, store) => {
    await assert.rejects(() => sync.deleteAccount({ confirm: "HAPUS", password: "salah" }, true), (e: any) => e.code === "invalid_password");
    assert.equal(sync.account().token, "session-u", "still signed in after a wrong password");
    assert.ok(store.get("kicks", "k1"), "nothing wiped");
    refuse = false;
    await sync.deleteAccount({ confirm: "HAPUS", password: "benar" }, false);
    assert.equal(sync.account().token, null);
    assert.ok(store.get("kicks", "k1"), "notes kept on this phone");
    assert.equal(memory.has("bb_sync_enabled:U"), false);
  });
});

test("re-login for deletion returns to Hapus akun; Profil links to it; vercel proxies /account on both hosts", async () => {
  await withSync(signedIn(), () => Response.json({ ok: true }), async (sync) => {
    await sync.reauthForDeletion();
    assert.equal(sync.account().token, null);
    assert.equal(sync.authDestination(), "#/hapus-akun");
  });
  assert.match(readFileSync("src/screens/Profil.tsx", "utf8"), /href="#\/hapus-akun"/);
  const rewrites = JSON.parse(readFileSync("vercel.json", "utf8")).rewrites.filter((r: any) => r.source === "/account/:path*");
  assert.deepEqual(rewrites.map((r: any) => r.destination), ["https://momong-api-staging.evanyudis.my.id/account/:path*", "https://momong-api.evanyudis.my.id/account/:path*"]);
  assert.equal(rewrites[0].has[0].value, "staging.momong.evanyudis.com");
});

test("Hapus akun screen asks a signed-out visitor to sign in first", async () => {
  Object.assign(globalThis, { localStorage: memoryStorage(new Map()), sessionStorage: memoryStorage(new Map()) });
  const server = await createServer({ server: { middlewareMode: true }, logLevel: "silent" });
  try {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { HapusAkun } = await server.ssrLoadModule("/src/screens/HapusAkun.tsx");
    const html = renderToStaticMarkup(createElement(HapusAkun));
    assert.match(html, /Masuk dulu untuk menghapus akun/);
  } finally { await server.close(); }
});
