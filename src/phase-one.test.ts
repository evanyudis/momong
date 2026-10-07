import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("Phase 1 ignores cached Plus access and renders a disabled coming-soon page without billing calls", async () => {
  const memory = new Map<string, string>([["bb_token", "old-test-session"], ["bb_me", JSON.stringify({ entitlement: { plan: "plus_lifetime", expiresAt: null } })]]);
  const storage = { get length() { return memory.size; }, key: (i: number) => [...memory.keys()][i] ?? null,
    getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => void memory.set(key, value), removeItem: (key: string) => void memory.delete(key) };
  Object.assign(globalThis, { localStorage: storage, sessionStorage: storage, window: {}, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
  Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
  const server = await createServer({ server: { middlewareMode: true }, define: { "import.meta.env.VITE_PLUS_ENABLED": JSON.stringify("false") } });
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("coming-soon page cannot initiate billing"); };
  try {
    await server.ssrLoadModule("/src/sync.ts");
    const store = await server.ssrLoadModule("/src/store.ts");
    assert.equal(store.isPlus(), false, "cached sandbox entitlement stays unavailable");
    const { Plus } = await server.ssrLoadModule("/src/screens/Plus.tsx");
    const html = renderToStaticMarkup(createElement(Plus));
    assert.match(html, /disabled=""[^>]*>Segera hadir<\/button>/);
    assert.ok(!html.includes("Rp199.000") && !html.includes("Rp39.000"));
    assert.equal(calls, 0);
    const { setPlusAccess } = store;
    const sync = await server.ssrLoadModule("/src/sync.ts");
    sync.account().me = { user: { id: "early", email: "early@example.com", name: "Early" }, entitlement: { plan: "trial", earlyAccess: true, expiresAt: new Date(Date.now() + 86400000).toISOString() } };
    assert.equal(sync.entitled(sync.account().me), true);
    assert.equal(sync.entitled({ entitlement: { plan: "trial", expiresAt: new Date(Date.now() + 86400000).toISOString() } }), false);
    assert.equal(sync.entitled({ entitlement: { plan: "trial", earlyAccess: true, expiresAt: new Date(Date.now() - 1).toISOString() } }), false);
    setPlusAccess(true);
    const trial = renderToStaticMarkup(createElement(Plus));
    assert.match(trial, /Early access kamu aktif/);
    assert.match(trial, /Tidak ada tagihan/);
    assert.ok(!trial.includes("Rp199.000") && !trial.includes("Rp39.000"));
    assert.equal(calls, 0, "early access status cannot initiate billing");
    sync.account().me.entitlement = { plan: "plus_lifetime", earlyAccess: true, expiresAt: null };
    assert.equal(sync.entitled(sync.account().me), true);
    const lifetime = renderToStaticMarkup(createElement(Plus));
    assert.match(lifetime, /Plus · Lifetime/);
    assert.match(lifetime, /gratis tanpa batas waktu/);
    assert.ok(!lifetime.includes("1970") && !lifetime.includes("Rp199.000"));
    assert.equal(sync.entitled({ entitlement: { plan: "plus_lifetime", expiresAt: null } }), false);
    assert.match(lifetime, /class="plus-page"/);
    assert.equal((lifetime.match(/class="plus-mesh"/g) ?? []).length, 1, "Plus has one shared page wave");
    assert.equal((lifetime.match(/class="plus-feature-icon"/g) ?? []).length, 7);
    assert.equal((lifetime.match(/card plus-glass/g) ?? []).length, 2, "status and features use glass cards");



  } finally { globalThis.fetch = original; await server.close(); }
});
