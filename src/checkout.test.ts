import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { MONTHLY_CONSENT_VERSION, checkoutErrorCopy, checkoutRequest, consentKey, planAvailable, readConsent, sumopodPaymentLink, sumopodPlans, writeConsent } from "./checkout";

test("QRIS checkout request matches momong-api sumopodCheckout shapes", () => {
  assert.equal(MONTHLY_CONSENT_VERSION, "monthly-v2");
  assert.deepEqual(checkoutRequest("monthly", "0123456789abcdef-key"), {
    path: "/billing/monthly",
    body: { method: "qris", consent: true, consentVersion: "monthly-v2", idempotencyKey: "0123456789abcdef-key" },
  });
  assert.deepEqual(checkoutRequest("plus_lifetime", "ignored-key-123456"), { path: "/billing/lifetime", body: {} });
  // crypto.randomUUID() keys satisfy the API's /^[a-zA-Z0-9-]{16,64}$/.
  assert.match(crypto.randomUUID(), /^[a-zA-Z0-9-]{16,64}$/);
});

test("payment link allowlist: https only, Sumopod and pymnt checkout hosts, no credentials", () => {
  for (const ok of ["https://pay.sumopod.com/link/abc123", "https://sumopod.com/pay/1", "https://a.b.sumopod.com/x", "https://PAY.SUMOPOD.COM/link/1", "https://checkout.pymnt.app/payment-links/6d99da1f", "https://sumo.sandbox.pymnt.global/x"])
    assert.ok(sumopodPaymentLink(ok), ok);
  for (const bad of ["http://pay.sumopod.com/link/1", "https://evilsumopod.com/x", "https://sumopod.com.evil.io/x", "https://evilpymnt.app/x", "https://pymnt.app.evil.io/x", "https://pay.sumopod.com@evil.io/x",
    "https://user:pw@pay.sumopod.com/x", "https://app.sandbox.midtrans.com/snap/v4/redirection/x", "javascript:alert(1)", "//pay.sumopod.com/x", "", undefined, null, 42])
    assert.equal(sumopodPaymentLink(bad), null, String(bad));
});

test("plans from a Midtrans API are not treated as QRIS-ready; Sumopod plans are", () => {
  const midtrans = { sandbox: true, plans: [{ id: "plus_lifetime", available: true }, { id: "monthly", methods: [{ id: "credit_card", available: true }, { id: "gopay", available: true }] }] };
  const sumopod = { sandbox: true, plans: [{ id: "plus_lifetime", available: true }, { id: "monthly", renewalMode: "manual", methods: [{ id: "qris", available: false }] }] };
  assert.equal(sumopodPlans(midtrans), false);
  assert.equal(planAvailable(midtrans, "plus_lifetime"), false, "never start a Midtrans lifetime order from the QRIS client");
  assert.equal(planAvailable(midtrans, "monthly"), false);
  assert.equal(sumopodPlans(sumopod), true);
  assert.equal(planAvailable(sumopod, "plus_lifetime"), true);
  assert.equal(planAvailable(sumopod, "monthly"), false);
  assert.equal(planAvailable(null, "plus_lifetime"), false);
});

test("monthly consent persists per account, plan and consent version, and can be cleared", () => {
  const memory = new Map<string, string>();
  const storage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => void memory.set(k, v), removeItem: (k: string) => void memory.delete(k) };
  assert.equal(readConsent(storage, "u1", "monthly"), false);
  writeConsent(storage, "u1", "monthly", true);
  assert.equal(readConsent(storage, "u1", "monthly"), true, "survives remount after visiting S&K");
  assert.equal(readConsent(storage, "u2", "monthly"), false, "scoped to account");
  assert.equal(readConsent(storage, "u1", "plus_lifetime"), false, "scoped to plan");
  assert.ok(consentKey("u1", "monthly").endsWith(":monthly-v2"), "a new consent version needs a new tick");
  writeConsent(storage, "u1", "monthly", false);
  assert.equal(readConsent(storage, "u1", "monthly"), false, "cleared after checkout");
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  assert.equal(readConsent(broken, "u1", "monthly"), false);
  assert.doesNotThrow(() => writeConsent(broken, "u1", "monthly", true));
});

test("Plus screen uses the QRIS helpers and no longer offers Midtrans", () => {
  const src = readFileSync(new URL("./screens/Plus.tsx", import.meta.url), "utf8");
  assert.ok(!src.includes("midtrans"), "no Midtrans host check");
  assert.ok(!src.includes("credit_card") && !src.includes("GoPay") && !src.includes("Kartu"), "card/GoPay options removed");
  assert.match(src, /checkoutRequest\(plan, idempotency\.current\)/);
  assert.match(src, /sumopodPaymentLink\(data\.redirectUrl\)/);
  assert.match(src, /writeConsent\(sessionStorage, userId, "monthly", false\);\n\s*location\.assign/, "consent cleared right before redirecting to payment");
  assert.match(checkoutErrorCopy("checkout_expired"), /link baru/);
  assert.match(checkoutErrorCopy("monthly_period_active"), /masih aktif/);
  assert.match(checkoutErrorCopy("subscription_exists"), /hentikan perpanjangan/);
});
