import assert from "node:assert/strict";
import { test } from "node:test";
import { todayISO } from "./dates.ts";

const memory = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
};
const { motherNameFromAccount, onboardingStep, saveOnboarding } = await import("./onboarding.ts");
const store = await import("./store.ts");

test("first screen is login, guests and authenticated users can set up without sync", () => {
  const local = { token: null, me: null };
  assert.equal(onboardingStep({}, local), "signin");
  assert.equal(onboardingStep({}, local, true), "setup");
  assert.equal(onboardingStep({}, { token: "token", me: {} }), "setup");
  assert.equal(onboardingStep({ hpl: "2027-01-01" }, local), "ready");
  assert.equal(onboardingStep({ birthMode: "postpartum" }, local), "ready");
});

test("mother name uses the account name or email, and remains editable at completion", () => {
  assert.equal(motherNameFromAccount({ name: " Sari ", email: "sari@example.com" }), "Sari");
  assert.equal(motherNameFromAccount({ name: " ", email: "sari@example.com" }), "sari");
});

test("setup rejects incomplete details without saving a mode or name", () => {
  const draft = { mode: "pregnant" as const, name: "Sari", hpl: "2027-01-01", babyName: "Nara", babyBirth: todayISO() };
  for (const changes of [
    { mode: undefined }, { name: " " }, { hpl: "" }, { hpl: "2027-02-30" },
    { mode: "postpartum" as const, babyName: " " },
    { mode: "postpartum" as const, babyBirth: "" },
    { mode: "postpartum" as const, babyBirth: "2999-01-01" },
  ]) {
    assert.equal(saveOnboarding({ ...draft, ...changes }), false);
    assert.deepEqual(store.settings(), {});
    assert.equal(store.getPrefs().name, undefined);
    assert.equal(store.pending().length, 0);
  }
});

test("both completed modes save the right fields and queue household sync", () => {
  assert.equal(saveOnboarding({ mode: "pregnant", name: " Sari Putri ", hpl: "2027-01-01", babyName: "", babyBirth: "" }), true);
  assert.equal(store.getPrefs().name, "Sari Putri");
  assert.equal(store.settings().birthMode, "pregnant");
  assert.equal(store.settings().hpl, "2027-01-01");
  assert.equal(store.settings().babyBirth, undefined);
  const birth = todayISO();
  assert.equal(saveOnboarding({ mode: "postpartum", name: " Sari ", hpl: "", babyName: " Nara ", babyBirth: birth }), true);
  assert.equal(store.getPrefs().name, "Sari");
  assert.equal(store.settings().birthMode, "postpartum");
  assert.equal(store.settings().babyName, "Nara");
  assert.equal(store.settings().babyBirth, birth);
  const change = store.pending().find((r) => r.collection === "settings" && r.id === "main");
  assert.ok(change);
  assert.equal(change.data?.babyName, "Nara");
  assert.equal(change.data?.babyBirth, birth);
});
