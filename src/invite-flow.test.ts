import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";

test("logged-out invite survives Google and waits for confirm", async () => {
  const memory = new Map<string, string>();
  const storage = {
    get length() { return memory.size; },
    key: (i: number) => [...memory.keys()][i] ?? null,
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  };
  const loc = { origin: "https://momong.test", hash: "#/", assigned: "", assign(url: string) { this.assigned = url; } };
  Object.assign(globalThis, { localStorage: storage, sessionStorage: storage, location: loc });
  Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
  const server = await createServer({ server: { middlewareMode: true }, define: { "import.meta.env.VITE_API_URL": JSON.stringify("http://test.local") } });
  const realFetch = globalThis.fetch;
  const calls: { path: string; body?: any }[] = [];
  const solo = {
    user: { id: "u2", email: "dita@example.com", name: "Dita" },
    entitlement: { plan: "free", expiresAt: null },
    household: { id: "h1", seats: 2, members: [{ id: "u2", email: "dita@example.com", name: "Dita", role: "owner" }] },
  };
  let me = structuredClone(solo);
  let joinStatus = 200;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path, body });
    if (path === "/api/auth/sign-in/social") return Response.json({ url: "https://accounts.google.com/o/oauth2/v2/auth" });
    if (path === "/api/auth/get-session") {
      assert.equal(loc.hash, "#/gabung?invite=inviteTok1", "the invite hash is restored before the session call");
      return Response.json({ session: { token: "google-session" } }, { headers: { "set-auth-token": "google-session" } });
    }
    if (path === "/me") return Response.json(me);
    if (path === "/household/join") {
      assert.equal(body.token, "inviteTok1");
      if (joinStatus !== 200) return Response.json({ error: "invite_invalid" }, { status: joinStatus });
      me = structuredClone(solo);
      me.household.members.push({ id: "u1", email: "adit@example.com", name: "Adit", role: "owner" });
      return Response.json({ ok: true });
    }
    if (path === "/sync") return Response.json({ cursor: 1, changes: [] });
    return Response.json({ ok: true });
  }) as typeof fetch;
  try {
    const sync = await server.ssrLoadModule("/src/sync.ts");
    const saveInvite = () => {
      memory.set("bb_pending_invite", "inviteTok1");
      memory.set("bb_pending_invite_at", String(Date.now()));
      memory.delete("bb_pending_invite_user");
    };
    const socialCalls = () => calls.filter((call) => call.path === "/api/auth/sign-in/social").length;
    saveInvite();
    loc.hash = "#/";
    loc.assigned = "";
    await sync.finishGoogle();
    assert.equal(loc.hash, "#/", "a saved invite does not move a logged-out home load");
    assert.equal(loc.assigned, "");
    assert.equal(socialCalls(), 0, "a saved invite does not start Google");

    memory.set("bb_google", "away");
    await sync.finishGoogle();
    assert.equal(loc.hash, "#/");
    assert.equal(memory.has("bb_google"), false, "a stale Google marker on home is dropped");
    assert.equal(socialCalls(), 0);

    loc.hash = "#/gabung?invite=inviteTok1";
    loc.assigned = "";
    for (const marker of [null, "away", "finishing"]) {
      if (marker) memory.set("bb_google", marker);
      else memory.delete("bb_google");
      await sync.finishGoogle();
    }
    assert.equal(loc.assigned, "", "loading or reloading the invite does not leave for Google");
    assert.equal(socialCalls(), 0, "loading the invite does not start Google");
    memory.delete("bb_google");
    loc.hash = "#/";

    memory.set("bb_google", "away");
    loc.hash = "#/masuk-akun";
    await sync.finishGoogle();
    assert.equal(loc.hash, "#/masuk-akun", "a cancelled Google return stays on sign-in");
    assert.equal(memory.get("bb_google"), "away");
    assert.equal(socialCalls(), 0);
    memory.delete("bb_google");
    loc.hash = "#/";

    saveInvite();
    assert.equal(sync.authDestination("#/"), "#/gabung?invite=inviteTok1", "after sign-in a saved invite opens the confirm step");

    memory.set("bb_auth_return", "#/gabung?invite=inviteTok1");
    await sync.startGoogle();
    const social = calls.find((call) => call.path === "/api/auth/sign-in/social");
    assert.equal(social?.body.callbackURL, "https://momong.test/#/profil");
    assert.equal(social?.body.errorCallbackURL, "https://momong.test/#/masuk-akun");
    assert.equal(loc.assigned, "https://accounts.google.com/o/oauth2/v2/auth");
    assert.equal(memory.get("bb_pending_invite"), "inviteTok1", "Google does not drop the invite");
    assert.equal(memory.get("bb_google"), "away");

    loc.hash = "#/profil";
    await sync.finishGoogle();
    assert.equal(calls.filter((call) => call.path === "/household/join").length, 0, "Google return does not join before confirm");
    assert.equal(sync.account().token, "google-session");
    assert.equal(memory.get("bb_pending_invite"), "inviteTok1");
    assert.equal(memory.get("bb_pending_invite_user"), "u2");
    assert.equal(loc.hash, "#/gabung?invite=inviteTok1");
    assert.equal(memory.has("bb_auth_return"), false);
    assert.equal(await sync.acceptInvite("inviteTok1"), "joined");
    assert.equal(calls.filter((call) => call.path === "/household/join").length, 1);
    assert.equal(sync.account().syncEnabled, true, "joining the invite turns sync on");
    assert.equal(memory.has("bb_pending_invite"), false);
    assert.equal(loc.hash, "#/gabung?invite=inviteTok1");

    await sync.signOut();
    saveInvite();
    memory.set("bb_pending_invite_user", "someone-else");
    memory.set("bb_google", "away");
    loc.hash = "#/profil";
    await sync.finishGoogle();
    assert.equal(memory.get("bb_pending_invite"), "inviteTok1", "a different account keeps the saved invite");
    assert.equal(memory.get("bb_pending_invite_user"), "someone-else");
    assert.equal(loc.hash, "#/gabung?invite=inviteTok1", "a different account opens the invite so they can choose");
    assert.equal(calls.filter((call) => call.path === "/household/join").length, 1);
    await sync.signOut();
    me = structuredClone(solo);
    joinStatus = 410;
    saveInvite();
    memory.set("bb_auth_return", "#/gabung?invite=inviteTok1");
    memory.set("bb_google", "away");
    loc.hash = "#/profil";
    await sync.finishGoogle();
    assert.equal(sync.account().token, "google-session", "a bad invite does not throw away the new session");
    assert.equal(loc.hash, "#/gabung?invite=inviteTok1");
    assert.notEqual(loc.hash, "#/masuk-akun");
    assert.equal(memory.get("bb_pending_invite"), "inviteTok1");
    await assert.rejects(() => sync.acceptInvite("inviteTok1"));
    assert.equal(sync.account().token, "google-session");
    assert.equal(sync.account().syncEnabled, true);

    const before = calls.filter((call) => call.path === "/household/join").length;
    const [again, duplicate] = await Promise.all([sync.consumePendingInvite("inviteTok1"), sync.consumePendingInvite("inviteTok1")]);
    assert.deepEqual(again, duplicate);
    assert.equal(again.ok, "failed");
    assert.equal(calls.filter((call) => call.path === "/household/join").length, before + 1, "a remount shares one join request");
  } finally {
    globalThis.fetch = realFetch;
    await server.close();
  }
});
