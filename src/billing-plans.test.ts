import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";

test("billing plans share in-flight requests, expire after a minute, and retry failures", async () => {
  const memory = new Map<string, string>();
  const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => void memory.set(key, value), removeItem: (key: string) => void memory.delete(key) };
  Object.assign(globalThis, { localStorage: storage, sessionStorage: storage });
  const server = await createServer({ server: { middlewareMode: true }, logLevel: "silent", define: { "import.meta.env.VITE_API_URL": JSON.stringify("http://test.local") } });
  const realFetch = globalThis.fetch, realNow = Date.now;
  let now = realNow(), calls = 0;
  Date.now = () => now;
  let respond: (response: Response) => void = () => { throw new Error("No pending request"); };
  let requested = Promise.withResolvers<void>();
  globalThis.fetch = (async (url: string) => {
    assert.equal(url, "http://test.local/billing/plans");
    calls++;
    return new Promise<Response>((resolve) => { respond = resolve; requested.resolve(); });
  }) as typeof fetch;
  try {
    const { loadBillingPlans } = await server.ssrLoadModule("/src/billing-plans.ts");
    const sheet = loadBillingPlans(), checkout = loadBillingPlans();
    await requested.promise;
    assert.equal(calls, 1);
    assert.equal(sheet, checkout, "sheet and checkout share the same request");
    const live = { sandbox: false, plans: [] };
    respond(Response.json(live));
    assert.deepEqual(await sheet, live);
    assert.deepEqual(await loadBillingPlans(), live);
    assert.equal(calls, 1, "reopening within one minute uses the cached result");

    now += 60_001;
    requested = Promise.withResolvers<void>();
    const failure = loadBillingPlans();
    await requested.promise;
    respond(Response.json({ error: "offline" }, { status: 400 }));
    await assert.rejects(failure);
    assert.equal(calls, 2, "expired cache refetches");

    requested = Promise.withResolvers<void>();
    const retry = loadBillingPlans();
    await requested.promise;
    assert.equal(calls, 3, "failed requests are not cached");
    const sandbox = { sandbox: true, plans: [] };
    respond(Response.json(sandbox));
    assert.deepEqual(await retry, sandbox, "updated payment mode replaces the old cache");
  } finally {
    globalThis.fetch = realFetch;
    Date.now = realNow;
    await server.close();
  }
});
