/** Checkout Plus lewat Sumopod QRIS. Logika murni supaya bisa dites tanpa DOM. */
export type CheckoutPlan = "monthly" | "plus_lifetime";

/** Versi teks persetujuan Plus Bulanan. Naikkan setiap kali kalimat checkbox berubah. */
export const MONTHLY_CONSENT_VERSION = "monthly-v2";
export const PAYMENT_METHOD = "qris";

/** Body persis seperti yang dibaca momong-api main (sumopod-billing.ts sumopodCheckout). Lifetime tidak membaca body. */
export function checkoutRequest(plan: CheckoutPlan, idempotencyKey: string) {
  return plan === "monthly"
    ? { path: "/billing/monthly", body: { method: PAYMENT_METHOD, consent: true, consentVersion: MONTHLY_CONSENT_VERSION, idempotencyKey } }
    : { path: "/billing/lifetime", body: {} };
}

/**
 * Link pembayaran hanya boleh ke host Sumopod: https, tanpa kredensial di URL, hostname persis sumopod.com atau *.sumopod.com.
 * Aturan ini sama dengan validasi base URL live di momong-api (payments/sumopod.ts). Host link hosted belum terdokumentasi resmi.
 */
/** Host checkout Sumopod yang terverifikasi: live checkout.pymnt.app (order prod 3 Nov 2026), sandbox sumo.sandbox.pymnt.global. */
const PAYMENT_LINK_DOMAINS = ["sumopod.com", "pymnt.app", "pymnt.global"];

export function sumopodPaymentLink(value: unknown): URL | null {
  if (typeof value !== "string" || !value) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  return PAYMENT_LINK_DOMAINS.some((d) => host === d || host.endsWith("." + d)) ? url : null;
}

/** /billing/plans dari server yang memakai PAYMENT_PROVIDER=sumopod punya metode bulanan "qris". Server Midtrans tidak. */
export function sumopodPlans(plans: any): boolean {
  const monthly = plans?.plans?.find?.((p: any) => p?.id === "monthly");
  return !!monthly?.methods?.some?.((m: any) => m?.id === PAYMENT_METHOD);
}

export function planAvailable(plans: any, plan: CheckoutPlan): boolean {
  if (!sumopodPlans(plans)) return false;
  const found = plans.plans.find((p: any) => p?.id === plan);
  return plan === "plus_lifetime" ? found?.available === true : found?.methods?.find((m: any) => m?.id === PAYMENT_METHOD)?.available === true;
}

/** Persetujuan bulanan disimpan per akun, paket, dan versi teks, supaya tidak hilang saat membuka S&K lalu kembali. */
export const consentKey = (userId: string | undefined, plan: CheckoutPlan) => `bb_plus_consent:${userId ?? "guest"}:${plan}:${MONTHLY_CONSENT_VERSION}`;
export function readConsent(storage: Pick<Storage, "getItem">, userId: string | undefined, plan: CheckoutPlan) {
  try { return storage.getItem(consentKey(userId, plan)) === "1"; } catch { return false; }
}
export function writeConsent(storage: Pick<Storage, "setItem" | "removeItem">, userId: string | undefined, plan: CheckoutPlan, value: boolean) {
  try { if (value) storage.setItem(consentKey(userId, plan), "1"); else storage.removeItem(consentKey(userId, plan)); } catch {}
}

export function checkoutErrorCopy(code: string | undefined): string {
  switch (code) {
    case "billing_unconfigured": return "Pembayaran QRIS belum dikonfigurasi. Coba lagi setelah server siap.";
    case "plus_coming_soon": return "Momong Plus belum dibuka.";
    case "production_disabled": return "Pembayaran QRIS belum aktif di server. Coba lagi nanti.";
    case "invalid_checkout": return "Link pembayaran belum bisa dibuka. Cek status pembayaran di bawah atau coba lagi nanti.";
    case "already_plus": return "Household kamu sudah punya Plus Lifetime.";
    case "monthly_period_active": return "Plus Bulanan kamu masih aktif. Perpanjangan bisa dibayar saat link-nya siap, sekitar 3 hari sebelum periode berakhir.";
    case "subscription_exists": return "Masih ada langganan bulanan. Kelola atau hentikan perpanjangan di bawah sebelum membuat langganan baru.";
    case "checkout_pending": return "Masih ada pembayaran yang belum selesai. Cek statusnya atau buka lagi link pembayarannya.";
    case "checkout_expired": return "Link pembayaran sebelumnya sudah kedaluwarsa. Tekan Konfirmasi untuk membuat link baru.";
    default: return "Checkout belum bisa dibuka. Cek koneksi lalu coba lagi.";
  }
}
