import assert from "node:assert/strict";
import { test } from "node:test";
import { homeGreeting, type GreetingAccount } from "./greeting.ts";

const household = (viewer: "owner" | "member", name: string, email = `${name || "akun"}@example.com`): GreetingAccount => ({
  user: { id: viewer, name, email },
  household: {
    members: [
      { id: "owner", name: "Bunda", role: "owner", email: "bunda@example.com" },
      { id: "member", name, role: "member", email },
    ],
  },
});

test("owner is greeted with her own nickname, not a partner name", () => {
  const me = household("owner", "Sari", "sari@example.com");
  me!.household!.members![0].name = "Sari";
  assert.equal(homeGreeting(me, "Bunda"), "Halo, Bunda");
  assert.equal(homeGreeting(me, "   "), "Halo, Sari");
});

test("partner is greeted with his account, even when the device nickname is the owner", () => {
  assert.equal(homeGreeting(household("member", "Adit", "adit@example.com"), "Bunda"), "Halo, Adit");
  assert.equal(homeGreeting(household("member", "Bunda", "adit@example.com"), "Bunda"), "Halo, Adit");
});

test("partner never sees Bunda, including when that is the only stored name", () => {
  assert.equal(homeGreeting(household("member", "Bunda", "bunda@example.com"), "Bunda"), "Halo!");
  assert.equal(homeGreeting(household("member", "  bunda ", "bunda@example.com"), "BUNDA"), "Halo!");
  const copied = household("member", "Sari", "sari@example.com");
  copied!.user.name = "Sari";
  copied!.household!.members![1].name = "Sari";
  copied!.household!.members![0].name = "Sari";
  assert.equal(homeGreeting(copied, "Sari"), "Halo!");
});

test("unknown account name and role use a neutral greeting", () => {
  assert.equal(homeGreeting(null, ""), "Halo!");
  assert.equal(homeGreeting(null, "   "), "Halo!");
  assert.equal(homeGreeting({ user: { id: "member", name: " ", email: " " }, household: { members: [] } }, "Bunda"), "Halo!");
});

test("a signed-out nickname still belongs to the person who saved it", () => {
  assert.equal(homeGreeting(null, "Sari"), "Halo, Sari");
  assert.equal(homeGreeting(undefined, "bunda"), "Halo, Bunda");
});

test("partner nickname is used when the account itself has no separate name", () => {
  assert.equal(homeGreeting(household("member", "", ""), "Ayah"), "Halo, Ayah");
});
