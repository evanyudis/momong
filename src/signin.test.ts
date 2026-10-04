import assert from "node:assert/strict";
import { test } from "node:test";
import { SIGNIN_EMPTY, failureFor, nameFromEmail, signIn, type SignInState } from "./signin.ts";

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
  const net = signIn(filled(), { type: "fail", status: 0 });
  assert.equal(signIn(net, { type: "password", value: "x" }).failure, null);
});

test("google goes to cancelled with both fields empty", () => {
  assert.deepEqual(signIn(filled(), { type: "google" }), { ...SIGNIN_EMPTY, googleCancelled: true });
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
  assert.equal(nameFromEmail("@x.co"), "BumpBuddy");
});
