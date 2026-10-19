import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";
import { onboardingExitHash } from "./invite.ts";

test("a logged-out invite is claimed by the account created or signed in during that flow", async () => {
  const memory = new Map<string, string>();
  const storage = {
    get length() { return memory.size; },
    key: (i: number) => [...memory.keys()][i] ?? null,
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  };
  const loc = { origin: "https://momong.test", hash: "#/masuk-akun", pathname: "/", search: "", assigned: "", replace(url: string) { this.hash = url.includes("#") ? url.slice(url.indexOf("#")) : url; }, assign(url: string) { this.assigned = url; } };
  Object.assign(globalThis, { localStorage: storage, sessionStorage: storage, location: loc });
  Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
  const server = await createServer({ server: { middlewareMode: true }, define: { "import.meta.env.VITE_API_URL": JSON.stringify("http://test.local") } });
  const realFetch = globalThis.fetch;
  const emailUser = {
    user: { id: "new-email", email: "new@example.com", name: "new" },
    entitlement: { plan: "free", expiresAt: null },
    household: { id: "h-email", seats: 2, members: [{ id: "new-email", email: "new@example.com", name: "new", role: "owner" }] },
  };
  const googleUser = {
    user: { id: "new-google", email: "g@example.com", name: "qa-d-1018" },
    entitlement: { plan: "free", expiresAt: null },
    household: { id: "h-google", seats: 2, members: [{ id: "new-google", email: "g@example.com", name: "qa-d-1018", role: "owner" }] },
  };
  const existingUser = {
    user: { id: "existing", email: "ada@example.com", name: "Ada" },
    entitlement: { plan: "free", expiresAt: null },
    household: { id: "h-existing", seats: 2, members: [{ id: "existing", email: "ada@example.com", name: "Ada", role: "owner" }] },
  };
  let me = emailUser;
  let allowSession = false;
  globalThis.fetch = (async (url: string) => {
    const path = new URL(url).pathname;
    if (path === "/api/auth/sign-up/email") return Response.json({ token: "email-session" }, { headers: { "set-auth-token": "email-session" } });
    if (path === "/api/auth/sign-in/email") return Response.json({ token: "email-session" }, { headers: { "set-auth-token": "email-session" } });
    if (path === "/api/auth/sign-in/social") return Response.json({ url: "https://accounts.google.com/o/oauth2/v2/auth" });
    if (path === "/api/auth/get-session") {
      if (!allowSession) return Response.json({}, { status: 401 });
      return Response.json({ session: { token: "google-session" } }, { headers: { "set-auth-token": "google-session" } });
    }
    if (path === "/me") return Response.json(me);
    if (path.endsWith("/preview")) return Response.json({ status: "valid", householdName: "qa-d-1018", full: false });
    if (path === "/sync") return Response.json({ cursor: 1, changes: [] });
    return Response.json({ ok: true });
  }) as typeof fetch;
  const saveInvite = (owner?: string) => {
    memory.set("bb_pending_invite", "inviteTok1");
    memory.set("bb_pending_invite_at", String(Date.now()));
    if (owner) memory.set("bb_pending_invite_user", owner);
    else memory.delete("bb_pending_invite_user");
  };
  try {
    const sync = await server.ssrLoadModule("/src/sync.ts");
    const store = await server.ssrLoadModule("/src/store.ts");

    saveInvite();
    memory.set("bb_pending_invite_flow", String(Date.now()));
    memory.set("bb_auth_return", "#/gabung?invite=inviteTok1");
    await sync.authEmail("daftar", "new@example.com", "password123");
    assert.equal(memory.get("bb_pending_invite"), "inviteTok1", "new email account keeps the invite");
    assert.equal(memory.get("bb_pending_invite_user"), "new-email");
    assert.equal(await sync.destinationAfterLogin("#/profil"), "#/profil", "Gabung waits until onboarding");
    assert.equal(memory.get("bb_pending_invite"), "inviteTok1");
    store.saveSettings({ birthMode: "postpartum", babyName: "Bayi Baru", babyBirth: "2026-10-01" });
    assert.equal(onboardingExitHash({ accountId: "new-email", ownerId: memory.get("bb_pending_invite_user") ?? null, token: memory.get("bb_pending_invite") ?? null }), "#/gabung?invite=inviteTok1");

    await sync.signOut();
    me = googleUser;
    store.resetDeviceData();
    saveInvite();
    memory.set("bb_pending_invite_flow", String(Date.now()));
    memory.set("bb_auth_return", "#/gabung?invite=inviteTok1");
    memory.set("bb_google", "away");
    allowSession = true;
    loc.hash = "#/profil";
    await sync.finishGoogle();
    assert.equal(sync.account().me.user.id, "new-google");
    assert.equal(memory.get("bb_pending_invite"), "inviteTok1", "new Google account keeps the invite");
    assert.equal(memory.get("bb_pending_invite_user"), "new-google");
    assert.equal(loc.hash, "#/profil", "Google sign-up also finishes onboarding before Gabung");
    assert.equal(store.getPrefs().name, "qa-d-1018", "an empty profile takes the account name");

    await sync.signOut();
    assert.equal(store.getPrefs().name, "qa-d-1018", "logout keeps the profile name on this device");
    me = existingUser;
    store.saveSettings({ birthMode: "postpartum", babyName: "Bayi Ada", babyBirth: "2026-10-01" });
    memory.set("bb_data_user", "existing");
    saveInvite();
    memory.set("bb_pending_invite_flow", String(Date.now()));
    memory.set("bb_auth_return", "#/gabung?invite=inviteTok1");
    loc.hash = "#/masuk-akun";
    await sync.authEmail("masuk", "ada@example.com", "password123");
    assert.equal(memory.get("bb_pending_invite_user"), "existing");
    assert.equal(store.settings().babyName, "Bayi Ada", "the same device restores this account's profile");
    assert.equal(await sync.destinationAfterLogin("#/profil"), "#/gabung?invite=inviteTok1");

    await sync.signOut();
    saveInvite("someone-else");
    memory.delete("bb_pending_invite_flow");
    memory.delete("bb_auth_return");
    await sync.authEmail("masuk", "ada@example.com", "password123");
    assert.equal(memory.has("bb_pending_invite"), false, "a leftover invite from another account is cleared");
    assert.equal(await sync.destinationAfterLogin("#/profil"), "#/", "a solo re-login with a profile opens Beranda");
    assert.equal(store.settings().babyName, "Bayi Ada");
  } finally {
    globalThis.fetch = realFetch;
    await server.close();
  }
});
