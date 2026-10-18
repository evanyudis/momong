import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";
import { SIGNIN_EMPTY, controllerChangeAction, failureFor, nameFromEmail, parseSignInDraft, signIn, signInDraft, signInInitial, signInRetryStep, signupStep, FAILURE_TEXT, type SignInState } from "./signin.ts";

const filled = (mode: SignInState["mode"] = "masuk") =>
  signIn(signIn({ ...SIGNIN_EMPTY, mode }, { type: "email", value: "a@b.co" }), { type: "password", value: "rahasia123" });

test("no email is special: submitting only marks the request pending", () => {
  for (const email of ["bunda@email", "a@b.co", ""]) {
    const s = signIn(signIn(SIGNIN_EMPTY, { type: "email", value: email }), { type: "submit" });
    assert.equal(s.pending, true);
    assert.equal(s.emailError, false, email);
  }
});

test("Email tidak cocok only for a failed Masuk (401), and both fields stay filled", () => {
  const s = signIn(signIn(filled(), { type: "submit" }), { type: "fail", status: 401 });
  assert.deepEqual([s.emailError, s.failure, s.pending, s.email, s.password], [true, null, false, "a@b.co", "rahasia123"]);
  assert.equal(failureFor("daftar", 401).emailError, false);
  for (const status of [0, 400, 422, 500]) assert.equal(failureFor("masuk", status).emailError, false, String(status));
});

test("unreachable server is an honest network failure, never success", () => {
  assert.deepEqual(failureFor("masuk", 0), { emailError: false, failure: "network" });
  assert.deepEqual(failureFor("daftar", 0), { emailError: false, failure: "network" });
  assert.equal(failureFor("masuk", 408).failure, "timeout");
  assert.equal(failureFor("daftar", 408).failure, "timeout");
});

test("signup url wins, and a reload during submit keeps the typed fields", () => {
  const draft = signInDraft({ mode: "masuk", email: "qa@example.com", password: "rahasia123", failure: "timeout" });
  const saved = parseSignInDraft(JSON.stringify(draft));
  const again = signInInitial(true, saved);
  assert.equal(again.mode, "daftar");
  assert.equal(again.email, "qa@example.com");
  assert.equal(again.password, "rahasia123");
  assert.equal(again.failure, "timeout");
  assert.equal(signInInitial(false, saved).mode, "masuk");
  const pending = signIn(again, { type: "submit" });
  assert.equal(pending.pending, true);
  assert.equal(pending.email, "qa@example.com");
  assert.equal(signIn(pending, { type: "fail", status: 408 }).failure, "timeout");
  assert.equal(signIn(pending, { type: "fail", status: 408 }).password, "rahasia123");
});

test("Daftar rejections and server errors get their own message", () => {
  assert.equal(failureFor("daftar", 422).failure, "daftar"); // email already used
  assert.equal(failureFor("daftar", 400).failure, "daftar"); // password too short
  assert.equal(failureFor("daftar", 500).failure, "other");
  assert.equal(failureFor("masuk", 503).failure, "other");
});

test("typing after a failure clears it", () => {
  const err = signIn(signIn(filled(), { type: "submit" }), { type: "fail", status: 401 });
  assert.equal(signIn(err, { type: "email", value: "a@b.c" }).emailError, false);
  assert.equal(signIn(err, { type: "password", value: "corrected" }).emailError, false);
  const net = signIn(filled(), { type: "fail", status: 0 });
  assert.equal(signIn(net, { type: "password", value: "x" }).failure, null);
});

test("google is pending until the browser leaves; back without a session shows cancelled", () => {
  const g = signIn(signIn(filled(), { type: "googleCancelled" }), { type: "google" });
  assert.deepEqual([g.pending, g.googleCancelled, g.failure, g.emailError], [true, false, null, false]);
  const back = signIn(g, { type: "googleCancelled" });
  assert.deepEqual([back.pending, back.googleCancelled], [false, true]);
});

test("google request failures never say Email tidak cocok", () => {
  const g = signIn(filled(), { type: "google" });
  assert.equal(signIn(g, { type: "googleFail", status: 0 }).failure, "network");
  for (const status of [401, 500]) {
    const s = signIn(g, { type: "googleFail", status });
    assert.deepEqual([s.failure, s.emailError, s.pending], ["other", false, false]);
  }
});

test("daftar and masuk swap modes in place; state never holds a token or signed-in flag", () => {
  const d = signIn(SIGNIN_EMPTY, { type: "mode", mode: "daftar" });
  assert.equal(d.mode, "daftar");
  const after = signIn(signIn(d, { type: "submit" }), { type: "fail", status: 422 });
  assert.deepEqual(Object.keys(after).sort(), Object.keys(SIGNIN_EMPTY).sort());
  assert.equal(signIn(after, { type: "mode", mode: "masuk" }).failure, null);
});

test("sign-up stays pending across a remount and blocks a service worker reload", () => {
  const again = signInInitial(true, null, { mode: "daftar", email: "qa@example.com", password: "rahasia123" });
  assert.equal(again.pending, true, "the button stays on Menyambungkan… after the form remounts");
  assert.equal(again.mode, "daftar");
  assert.equal(again.email, "qa@example.com");
  assert.equal(again.password, "rahasia123");
  assert.equal(controllerChangeAction(again.pending), "defer");
  assert.equal(controllerChangeAction(false), "reload");
});

test("a lost sign-up session retries sign-in, then opens login with the email", () => {
  assert.equal(signupStep({ status: 200, followUpFailed: true }), "retry-signin");
  assert.equal(signupStep({ status: 408, followUpFailed: false }), "retry-signin");
  assert.equal(signupStep({ status: 0, followUpFailed: false }), "retry-signin");
  assert.equal(signupStep({ status: 422, followUpFailed: false }), "registered");
  assert.equal(signInRetryStep({ signInStatus: 200, followUpFailed: false, signupSucceeded: true }), "done");
  assert.equal(signInRetryStep({ signInStatus: 401, followUpFailed: false, signupSucceeded: true }), "created-login");
  assert.equal(signInRetryStep({ signInStatus: 401, followUpFailed: false, signupSucceeded: false }), "show-error");
  const created = signIn(signIn(filled("daftar"), { type: "submit" }), { type: "fail", status: 409, failure: "created" });
  assert.equal(created.mode, "masuk");
  assert.equal(created.failure, "created");
  assert.equal(created.email, "a@b.co");
  assert.equal(created.pending, false);
  assert.equal(FAILURE_TEXT.created, "Akun sudah dibuat. Masuk untuk lanjut.");
  const fromNotice = signInInitial(true, { mode: "daftar", email: "qa@example.com", password: "rahasia123", failure: "created" }, null, true);
  assert.equal(fromNotice.mode, "masuk");
  assert.equal(fromNotice.email, "qa@example.com");
  assert.equal(fromNotice.failure, "created");
});

test("an email that is already registered keeps the address and opens Masuk", () => {
  const failed = signIn(signIn(filled("daftar"), { type: "submit" }), { type: "fail", status: 422 });
  assert.equal(failed.failure, "daftar");
  assert.match(FAILURE_TEXT.daftar, /sudah terdaftar/);
  const login = signIn(failed, { type: "mode", mode: "masuk" });
  assert.equal(login.mode, "masuk");
  assert.equal(login.email, "a@b.co");
  assert.equal(login.password, "rahasia123");
  assert.equal(login.pending, false);
});

test("sign-up name comes from the email, with a fallback", () => {
  assert.equal(nameFromEmail(" bunda.sari@gmail.com "), "bunda.sari");
  assert.equal(nameFromEmail("@x.co"), "Momong");
});

test("sign-up keeps loading through the session chain and recovers when that chain drops", async () => {
  const memory = new Map<string, string>();
  const storage = {
    get length() { return memory.size; },
    key: (i: number) => [...memory.keys()][i] ?? null,
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  };
  const loc = { hash: "#/masuk-akun?mode=signup", origin: "http://localhost" };
  Object.assign(globalThis, { localStorage: storage, sessionStorage: storage, location: loc });
  Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
  const server = await createServer({ server: { middlewareMode: true }, define: { "import.meta.env.VITE_API_URL": JSON.stringify("http://test.local") } });
  const realFetch = globalThis.fetch;
  const calls: string[] = [];
  let mode: "timeout" | "registered" | "cookie" | "created" = "timeout";
  const account = {
    user: { id: "qa-new", email: "qa-new@example.com", name: "qa-new" },
    entitlement: { plan: "free", expiresAt: null },
    household: { id: "h-new", seats: 2, members: [{ id: "qa-new", email: "qa-new@example.com", name: "qa-new", role: "owner" }] },
  };
  let sync: { authIsPending: () => boolean; onControllerChange: () => string; authEmail: (mode: "daftar" | "masuk", email: string, password: string) => Promise<void>; signOut: () => Promise<void>; account: () => { token: string | null }; authUi: () => { result: { failure: string | null } | null } };
  globalThis.fetch = (async (url: string) => {
    const path = new URL(url).pathname;
    calls.push(path);
    if (path === "/api/auth/sign-up/email" && mode === "timeout") {
      assert.equal(sync.authIsPending(), true, "loading stays up while sign-up, session, /me and /sync run");
      assert.equal(sync.onControllerChange(), "defer");
      assert.equal(memory.has("bb_auth_attempt"), true);
      const error = new Error("aborted");
      error.name = "TimeoutError";
      throw error;
    }
    if (path === "/api/auth/sign-up/email" && mode === "registered") return Response.json({ code: "USER_ALREADY_EXISTS" }, { status: 422 });
    if (path === "/api/auth/sign-up/email" && mode === "cookie") return Response.json({});
    if (path === "/api/auth/sign-up/email") return Response.json({ token: "created" });
    if (path === "/api/auth/get-session" && mode === "cookie") return Response.json({ session: { token: "cookie-session" } }, { headers: { "set-auth-token": "cookie-session" } });
    if (path === "/api/auth/get-session") return Response.json({}, { status: 401 });
    if (path === "/api/auth/sign-in/email" && mode === "created") return Response.json({ message: "Invalid" }, { status: 401 });
    if (path === "/api/auth/sign-in/email") return Response.json({ token: "signed-in" });
    if (path === "/me" && mode === "created") return Response.json({ error: "down" }, { status: 500 });
    if (path === "/me") return Response.json(account);
    if (path === "/sync") return Response.json({ cursor: 1, changes: [] });
    return Response.json({ ok: true });
  }) as typeof fetch;
  try {
    sync = await server.ssrLoadModule("/src/sync.ts");
    await sync.authEmail("daftar", "qa-new@example.com", "test-password");
    assert.equal(sync.authIsPending(), false);
    assert.ok(calls.includes("/api/auth/sign-in/email"), "a lost sign-up response signs in with the same password");
    assert.equal(sync.account().token, "signed-in");

    calls.length = 0;
    mode = "cookie";
    await sync.signOut();
    await sync.authEmail("daftar", "qa-new@example.com", "test-password");
    assert.equal(calls.includes("/api/auth/sign-in/email"), false, "a session cookie finishes the chain without posting sign-up again");
    assert.equal(sync.account().token, "cookie-session");

    calls.length = 0;
    mode = "registered";
    await sync.signOut();
    await assert.rejects(sync.authEmail("daftar", "qa-new@example.com", "test-password"));
    assert.equal(calls.includes("/api/auth/sign-in/email"), false);
    assert.equal(calls.includes("/api/auth/get-session"), false);
    assert.equal(sync.authUi().result.failure, "daftar");
    assert.equal(sync.authIsPending(), false);

    calls.length = 0;
    mode = "created";
    loc.hash = "#/masuk-akun?mode=signup";
    await assert.rejects(sync.authEmail("daftar", "qa-new@example.com", "test-password"), (error: { code?: string }) => error.code === "created");
    assert.ok(calls.includes("/api/auth/sign-in/email"));
    assert.equal(loc.hash, "#/masuk-akun");
    assert.equal(memory.get("bb_auth_notice"), "created");
    assert.equal(JSON.parse(memory.get("bb_signin_draft")!).email, "qa-new@example.com");
    assert.equal(JSON.parse(memory.get("bb_signin_draft")!).mode, "masuk");
    assert.equal(sync.authIsPending(), false);
  } finally {
    globalThis.fetch = realFetch;
    await server.close();
  }
});
