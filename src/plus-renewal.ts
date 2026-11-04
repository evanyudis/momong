import { finishedPayment, sumopodPaymentLink, type PaymentOrder } from "./checkout";
import type { Me } from "./sync";

export type BillingAccount = {
  shared: boolean;
  subscriptions: { id: string; state: string; periodEnd: string | null; lastError?: string | null }[];
  orders: (PaymentOrder & { periodEnd?: string | null })[];
};

type RenewalStatus = {
  state: "none" | "lifetime" | "active" | "due" | "expired" | "stopped";
  label: string | null;
  activeUntil?: string;
  action: string | null;
  subtle: boolean;
};

/** /me retains monthly plan/expiry after lapse; billing is scoped to the payer. */
export function plusRenewalStatus(entitlement: Me["entitlement"] | undefined, billing: BillingAccount | null, now: number): RenewalStatus {
  const none: RenewalStatus = { state: "none", label: null, action: null, subtle: false };
  if (entitlement?.plan === "plus_lifetime") return { ...none, state: "lifetime", label: "Selamanya" };
  if (entitlement?.plan !== "monthly" || !entitlement.expiresAt) return none;
  const expires = Date.parse(entitlement.expiresAt);
  if (!Number.isFinite(expires)) return none;
  const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(expires);
  const subscription = billing?.subscriptions.find((sub) => sub.periodEnd && Date.parse(sub.periodEnd) === expires);
  if (subscription && (subscription.state === "cancel_pending" || subscription.state === "cancelled" && subscription.lastError !== "lapsed")) {
    return { state: "stopped", label: `Berakhir ${date}`, action: "Perpanjang", subtle: true };
  }
  // A shared member cannot see the payer's cancellation choice. Keep their link quiet too.
  if (billing?.shared) return { state: expires <= now ? "expired" : "active", label: expires <= now ? `Berakhir ${date}` : `Aktif hingga ${date}`, action: "Lihat status Plus", subtle: true };
  if (expires <= now) return { state: "expired", label: `Plus berakhir ${date}`, action: billing ? `Plus berakhir ${date} · Perpanjang` : null, subtle: false };
  const ready = billing?.orders.some((order) => order.plan === "monthly" && order.periodEnd && Date.parse(order.periodEnd) > expires && !finishedPayment(order) && (!!sumopodPaymentLink(order.redirectUrl) || !!order.paymentCode));
  if (billing && (ready || expires - now <= 3 * 86_400_000)) {
    return { state: "due", activeUntil: `Aktif hingga ${date}`, label: `Berakhir ${date}`, action: "Perpanjang sekarang", subtle: false };
  }
  return { ...none, state: "active", label: `Aktif hingga ${date}` };
}
