import assert from "node:assert/strict";
import { test } from "node:test";
import { SIGNIN_EMPTY, signIn, type SignInState } from "./signin.ts";

const submit = (email: string, mode: SignInState["mode"] = "masuk") =>
  signIn(signIn({ ...SIGNIN_EMPTY, mode }, { type: "email", value: email }), { type: "submit" });

test("only bunda@email yields the email error, and the field stays filled", () => {
  const s = submit("bunda@email");
  assert.equal(s.emailError, true);
  assert.equal(s.email, "bunda@email");
  for (const email of ["", "bunda@email.com", "Bunda@email", " bunda@email", "ayah@email", "a@b.co"]) {
    assert.equal(submit(email).emailError, false, email);
    assert.equal(submit(email, "daftar").emailError, false, email);
  }
});

test("typing after the error clears the red line", () => {
  assert.equal(signIn(submit("bunda@email"), { type: "email", value: "bunda@emai" }).emailError, false);
});

test("google goes to cancelled with both fields empty", () => {
  const filled = signIn(signIn(SIGNIN_EMPTY, { type: "email", value: "a@b.co" }), { type: "password", value: "rahasia" });
  assert.deepEqual(signIn(filled, { type: "google" }), { ...SIGNIN_EMPTY, googleCancelled: true });
});

test("daftar and masuk swap modes in place and never create an account or session", () => {
  const d = signIn(SIGNIN_EMPTY, { type: "mode", mode: "daftar" });
  assert.equal(d.mode, "daftar");
  const after = signIn(signIn(d, { type: "email", value: "baru@email.com" }), { type: "submit" });
  // The state only ever holds these keys: no token, account, entitlement, or signed-in flag.
  assert.deepEqual(Object.keys(after).sort(), Object.keys(SIGNIN_EMPTY).sort());
  assert.equal(signIn(after, { type: "mode", mode: "masuk" }).mode, "masuk");
});
