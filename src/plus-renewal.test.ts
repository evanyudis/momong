import assert from "node:assert/strict";
import { test } from "node:test";
import { plusRenewalStatus, type BillingAccount } from "./plus-renewal.ts";

const now = Date.parse("2026-11-04T12:00:00Z");
const day = 86_400_000;
const monthly = (expires = now + 10 * day) => ({ plan: "monthly" as const, expiresAt: new Date(expires).toISOString() });
const billing: BillingAccount = { shared: false, subscriptions: [], orders: [] };
const renewalOrder = { orderId: "renewal", plan: "monthly", status: "pending", grantedAt: null, periodEnd: "2026-12-14T12:00:00Z", redirectUrl: "https://checkout.pymnt.app/renew" };

test("active monthly displays the long Indonesian date in Jakarta across UTC midnight", () => {
  assert.deepEqual(plusRenewalStatus(monthly(Date.parse("2026-11-14T18:00:00Z")), billing, now), {
    state: "active", label: "Aktif hingga 15 November 2026", action: null, subtle: false,
  });
});

test("lifetime is forever even with stale expiry and pending orders", () => {
  assert.deepEqual(plusRenewalStatus({ plan: "plus_lifetime", expiresAt: new Date(now - day).toISOString() }, { ...billing, orders: [renewalOrder] }, now), {
    state: "lifetime", label: "Selamanya", action: null, subtle: false,
  });
});

test("free, trial, missing and invalid monthly expiries have no renewal prompt", () => {
  for (const entitlement of [undefined, { plan: "free" as const, expiresAt: null }, { plan: "trial" as const, expiresAt: monthly().expiresAt }, { plan: "monthly" as const, expiresAt: null }, { plan: "monthly" as const, expiresAt: "bad-date" }]) {
    assert.deepEqual(plusRenewalStatus(entitlement, billing, now), { state: "none", label: null, action: null, subtle: false });
  }
});

test("the three-day window is inclusive and uses exact expiry instants", () => {
  assert.equal(plusRenewalStatus(monthly(now + 3 * day + 1), billing, now).state, "active");
  for (const remaining of [3 * day, day, 1]) {
    const status = plusRenewalStatus(monthly(now + remaining), billing, now);
    assert.equal(status.state, "due");
    assert.equal(status.action, "Perpanjang sekarang");
    assert.match(status.label!, /^Berakhir /);
    assert.match(status.activeUntil!, /^Aktif hingga /);
  }
});

test("a ready renewal URL or QR prompts renewal even before the three-day window", () => {
  for (const order of [renewalOrder, { ...renewalOrder, redirectUrl: undefined, paymentCode: "qris-code" }]) {
    assert.equal(plusRenewalStatus(monthly(), { ...billing, orders: [order] }, now).state, "due");
  }
});

test("old, completed, failed, flagged and non-monthly orders do not prompt renewal", () => {
  for (const change of [
    { periodEnd: monthly().expiresAt }, { periodEnd: null }, { status: "expire" }, { status: "cancel" },
    { grantedAt: new Date(now).toISOString() }, { needsReview: true }, { needsRefund: true }, { refunded: true },
    { plan: "plus_lifetime" }, { redirectUrl: "https://example.com/pay" }, { redirectUrl: undefined },
  ]) {
    assert.equal(plusRenewalStatus(monthly(), { ...billing, orders: [{ ...renewalOrder, ...change }] }, now).state, "active");
  }
});

test("expiry and lapse show the full renewal CTA; a renewed expiry removes it", () => {
  for (const expires of [now, now - day]) {
    const status = plusRenewalStatus(monthly(expires), billing, now);
    assert.equal(status.state, "expired");
    assert.equal(status.action, `Plus berakhir ${expires === now ? "4" : "3"} November 2026 · Perpanjang`);
  }
  assert.equal(plusRenewalStatus(monthly(now + 30 * day), billing, now).state, "active");
});

test("stopping the current period suppresses urgent CTAs before and after expiry", () => {
  for (const state of ["cancel_pending", "cancelled"]) {
    for (const expires of [now + day, now - day]) {
      const status = plusRenewalStatus(monthly(expires), { ...billing, orders: [renewalOrder], subscriptions: [{ id: "current", state, periodEnd: monthly(expires).expiresAt }] }, now);
      assert.equal(status.state, "stopped");
      assert.match(status.label!, /^Berakhir /);
      assert.equal(status.action, "Perpanjang");
      assert.equal(status.subtle, true);
    }
  }
});

test("automatic lapse is distinct from choosing to stop renewal", () => {
  const entitlement = monthly(now - day);
  assert.equal(plusRenewalStatus(entitlement, { ...billing, subscriptions: [{ id: "lapsed", state: "cancelled", periodEnd: entitlement.expiresAt, lastError: "lapsed" }] }, now).state, "expired");
});

test("cancellation from an older period cannot suppress the current renewal", () => {
  const status = plusRenewalStatus(monthly(now + day), { ...billing, subscriptions: [{ id: "old", state: "cancelled", periodEnd: monthly(now - 30 * day).expiresAt }] }, now);
  assert.equal(status.state, "due");
});

test("shared members get quiet status links because cancellation is payer-only", () => {
  for (const expires of [now + day, now - day]) {
    const status = plusRenewalStatus(monthly(expires), { ...billing, shared: true }, now);
    assert.equal(status.action, "Lihat status Plus");
    assert.equal(status.subtle, true);
  }
});

test("pending or unavailable billing preserves expiry without flashing an urgent CTA", () => {
  for (const expires of [now + day, now - day]) {
    const status = plusRenewalStatus(monthly(expires), null, now);
    assert.ok(status.label);
    assert.equal(status.action, null);
  }
});
