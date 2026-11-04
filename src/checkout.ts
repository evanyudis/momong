/** Checkout Plus lewat Sumopod QRIS. Logika murni supaya bisa dites tanpa DOM. */
export type CheckoutPlan = "monthly" | "plus_lifetime";

/** Versi teks persetujuan Plus Bulanan. Naikkan setiap kali kalimat checkbox berubah. */
export const MONTHLY_CONSENT_VERSION = "monthly-v2";
export const PAYMENT_METHOD = "qris";

export function paymentModeCopy(sandbox: boolean | undefined): string | null {
  if (sandbox === false) return "Pembayaran asli lewat Sumopod (QRIS dan lainnya).";
  if (sandbox === true) return "Mode uji (sandbox). Tidak ada uang nyata yang ditagih.";
  return null;
}

/** Body persis seperti yang dibaca momong-api main (sumopod-billing.ts sumopodCheckout). Lifetime tidak membaca body. */
export function checkoutRequest(plan: CheckoutPlan, idempotencyKey: string) {
  return plan === "monthly"
    ? { path: "/billing/monthly", body: { method: PAYMENT_METHOD, consent: true, consentVersion: MONTHLY_CONSENT_VERSION, idempotencyKey } }
    : { path: "/billing/lifetime", body: {} };
}

/**
 * Link pembayaran hanya boleh https, tanpa kredensial di URL, ke host checkout Sumopod yang terverifikasi persis:
 * live checkout.pymnt.app (order prod 3 Nov 2026) dan sandbox sumo.sandbox.pymnt.global, plus sumopod.com / *.sumopod.com.
 * Sama dengan validasi server di momong-api (payments/sumopod.ts sumopodPaymentLinkAllowed).
 */
export const PAYMENT_LINK_HOSTS = ["checkout.pymnt.app", "sumo.sandbox.pymnt.global"];

export function sumopodPaymentLink(value: unknown): URL | null {
  if (typeof value !== "string" || !value) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  return PAYMENT_LINK_HOSTS.includes(host) || host === "sumopod.com" || host.endsWith(".sumopod.com") ? url : null;
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
    case "provider_failed": return "Sumopod belum bisa membuat link pembayaran. Tekan Konfirmasi sekali lagi untuk mencoba ulang.";
    case "checkout_pending": return "Masih ada pembayaran yang belum selesai. Cek statusnya atau buka lagi link pembayarannya.";
    case "checkout_expired": return "Link pembayaran sebelumnya sudah kedaluwarsa. Tekan Konfirmasi untuk membuat link baru.";
    default: return "Checkout belum bisa dibuka. Cek koneksi lalu coba lagi.";
  }
}

export type PaymentOrder = {
  orderId: string; status: string; grantedAt: string | null; plan?: string; amount?: number; createdAt?: string;
  redirectUrl?: string; paymentCode?: string; needsRefund?: boolean; needsReview?: boolean; refunded?: boolean;
};
export const SUPPORT_EMAIL = "contact.evanyudis@gmail.com";
const TERMINAL = ["deny", "cancel", "expire", "failure"];
export const paymentLabel = (order: PaymentOrder) => order.refunded ? "Dana dikembalikan" : order.grantedAt ? order.plan === "monthly" ? "Plus · Bulanan aktif" : "Plus · Lifetime aktif"
  : order.needsRefund ? "Pembayaran dobel · refund manual" : order.needsReview ? "Pembayaran sedang dicek manual" : ({
    deny: "Pembayaran ditolak", cancel: "Pembayaran dibatalkan", expire: "Pembayaran kedaluwarsa", failure: "Pembayaran gagal",
  } as Record<string, string>)[order.status] ?? "Menunggu konfirmasi pembayaran";
/** Order sudah diputuskan: polling berhenti dan link bayar disembunyikan. Termasuk tanda operator (dobel / dicek manual / refund). */
export const finishedPayment = (order: PaymentOrder) => !!order.grantedAt || TERMINAL.includes(order.status) || !!order.needsRefund || !!order.needsReview || !!order.refunded;
/** Order yang masih menahan checkout baru. Dobel bayar tidak menahan (server juga melepasnya); dicek manual menahan sampai kedaluwarsa, sama dengan server. */
export const blocksCheckout = (order: PaymentOrder) => !finishedPayment(order) || !!order.needsReview && !order.grantedAt && !order.refunded && !TERMINAL.includes(order.status);
/** Link/QR lama sudah mati dan user boleh membuat link baru. */
export const expiredPayment = (order: PaymentOrder) => !order.grantedAt && !order.refunded && !order.needsRefund && !order.needsReview && TERMINAL.includes(order.status);
export function orderNotice(order: PaymentOrder): string | null {
  if (order.refunded || order.grantedAt) return null;
  if (order.needsRefund) return `Pembayaranmu tercatat dobel, jadi tidak menambah masa Plus. Kami akan refund manual dalam 7 hari kerja. Hubungi ${SUPPORT_EMAIL} kalau ada pertanyaan.`;
  if (order.needsReview) return `Pembayaranmu bermasalah dan sedang kami cek manual. Kalau tidak bisa diproses, kami refund manual dalam 7 hari kerja. Hubungi ${SUPPORT_EMAIL}.`;
  return null;
}
/** Kode error checkout: 502 berarti Sumopod gagal membuat link (server menandai order gagal), beda dengan order yang masih menunggu. */
export const checkoutErrorCode = (status: number | undefined, code: string | undefined) => status === 502 ? "provider_failed" : code;
