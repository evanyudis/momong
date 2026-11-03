import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { MONTHLY_CONSENT_VERSION, PAYMENT_LINK_HOSTS, blocksCheckout, checkoutErrorCode, checkoutErrorCopy, checkoutRequest, consentKey, expiredPayment, finishedPayment, orderNotice, paymentLabel, planAvailable, readConsent, sumopodPaymentLink, sumopodPlans, writeConsent, type PaymentOrder } from "./checkout";
import { parseHash, stripPaymentReturn } from "./route-parse";

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

test("payment link allowlist: https only, exact pymnt checkout hosts plus Sumopod, no credentials", () => {
  assert.deepEqual(PAYMENT_LINK_HOSTS, ["checkout.pymnt.app", "sumo.sandbox.pymnt.global"]);
  for (const bad of ["https://pymnt.app/x", "https://x.checkout.pymnt.app/x", "https://other.pymnt.app/x", "https://pymnt.global/x", "https://evil.pymnt.global/x", "https://sandbox.pymnt.global/x"])
    assert.equal(sumopodPaymentLink(bad), null, "not pinned: " + bad);
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

const order = (o: Partial<PaymentOrder>): PaymentOrder => ({ orderId: "o", status: "pending", grantedAt: null, ...o });

test("paid_needs_refund: not pending, no pay link, plan selection free again, clear refund copy", () => {
  const refund = order({ status: "settlement", needsRefund: true, redirectUrl: "https://checkout.pymnt.app/payment-links/x" });
  assert.equal(finishedPayment(refund), true, "polling stops and the pay link hides");
  assert.equal(blocksCheckout(refund), false, "Konfirmasi is usable again (server excludes refund flags from pending guards)");
  assert.equal(expiredPayment(refund), false);
  assert.equal(paymentLabel(refund), "Pembayaran dobel · refund manual");
  assert.match(orderNotice(refund)!, /dobel/); assert.match(orderNotice(refund)!, /refund manual dalam 7 hari kerja/); assert.match(orderNotice(refund)!, /contact\.evanyudis@gmail\.com/);
});

test("needs_review: polling stops and link hides, checkout stays held until the order expires", () => {
  const review = order({ needsReview: true });
  assert.equal(finishedPayment(review), true);
  assert.equal(blocksCheckout(review), true, "server still counts it as pending");
  assert.equal(blocksCheckout(order({ needsReview: true, status: "expire" })), false, "released once expired");
  assert.equal(paymentLabel(review), "Pembayaran sedang dicek manual");
  assert.match(orderNotice(review)!, /cek manual/); assert.match(orderNotice(review)!, /contact\.evanyudis@gmail\.com/);
});

test("ordinary order states keep their behaviour", () => {
  assert.equal(finishedPayment(order({})), false); assert.equal(blocksCheckout(order({})), true); assert.equal(orderNotice(order({})), null);
  assert.equal(paymentLabel(order({})), "Menunggu konfirmasi pembayaran");
  assert.equal(expiredPayment(order({ status: "expire" })), true);
  assert.equal(paymentLabel(order({ grantedAt: "2026-11-03T00:00:00Z", plan: "monthly" })), "Plus · Bulanan aktif");
  assert.equal(paymentLabel(order({ grantedAt: "2026-11-03T00:00:00Z", status: "cancel", refunded: true })), "Dana dikembalikan");
  assert.equal(blocksCheckout(order({ grantedAt: "2026-11-03T00:00:00Z" })), false);
});

test("502 from checkout is a provider failure with its own copy; 409 checkout_pending keeps its copy", () => {
  assert.equal(checkoutErrorCode(502, "checkout_pending"), "provider_failed");
  assert.equal(checkoutErrorCode(409, "checkout_pending"), "checkout_pending");
  assert.notEqual(checkoutErrorCopy("provider_failed"), checkoutErrorCopy("checkout_pending"));
  assert.match(checkoutErrorCopy("provider_failed"), /Sumopod belum bisa membuat link/);
});

test("hash routing tolerates params appended by the payment provider and strips payment_return", () => {
  assert.deepEqual(parseHash("#/plus"), { path: "/plus", query: "" });
  assert.deepEqual(parseHash("#/plus?status=paid"), { path: "/plus", query: "status=paid" });
  assert.deepEqual(parseHash("#/plus&status=paid&order_id=x"), { path: "/plus", query: "status=paid&order_id=x" });
  assert.deepEqual(parseHash(""), { path: "/", query: "" });
  assert.deepEqual(parseHash("#&x=1"), { path: "/", query: "x=1" });
  assert.equal(stripPaymentReturn("https://momong.evanyudis.com/?payment_return=1#/plus"), "/#/plus");
  assert.equal(stripPaymentReturn("https://momong.evanyudis.com/?payment_return=1&utm=a#/plus&status=paid"), "/?utm=a#/plus&status=paid");
  assert.equal(stripPaymentReturn("https://momong.evanyudis.com/#/plus"), null);
  const route = readFileSync(new URL("./route.ts", import.meta.url), "utf8");
  assert.match(route, /stripPaymentReturn\(location\.href\)/); assert.match(route, /parseHash\(location\.hash\)/);
});

test("Plus screen: sandbox chip and copy only from loaded sandbox plans, QR fallback, key rotation after 502", () => {
  const src = readFileSync(new URL("./screens/Plus.tsx", import.meta.url), "utf8");
  assert.match(src, /plans\?\.sandbox === true && <span className="pill plus-chip">Momong Plus · Sandbox<\/span>/);
  assert.match(src, /!plans \? plansFailed \? "Info pembayaran belum termuat\." : "Memuat info pembayaran…"/, "no sandbox copy while loading or failed");
  assert.match(src, /<PaymentQr value=\{order\.paymentCode\} \/>/);
  assert.match(src, /from "uqr"/);
  assert.match(src, /code === "checkout_expired" \|\| code === "provider_failed"\) idempotency\.current = crypto\.randomUUID\(\)/);
  assert.match(src, /blocksCheckout\(order\)\)\}/, "Konfirmasi gate uses blocksCheckout");
  assert.ok(!src.includes('if (!url) throw new Error("invalid_checkout")'), "QR-only responses no longer throw");
});
