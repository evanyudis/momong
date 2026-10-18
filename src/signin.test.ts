import assert from "node:assert/strict";
import { test } from "node:test";
import { SIGNIN_EMPTY, failureFor, nameFromEmail, parseSignInDraft, signIn, signInDraft, signInInitial, type SignInState } from "./signin.ts";

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

test("sign-up name comes from the email, with a fallback", () => {
  assert.equal(nameFromEmail(" bunda.sari@gmail.com "), "bunda.sari");
  assert.equal(nameFromEmail("@x.co"), "Momong");
});
