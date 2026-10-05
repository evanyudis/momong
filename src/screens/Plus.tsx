import { useEffect, useRef, useState } from "react";
import { ApiError, api, refreshMe, useAccount } from "../sync";
import { TopBar } from "../ui";

export type PaymentOrder = { orderId: string; status: string; grantedAt: string | null };
export const paymentLabel = (order: PaymentOrder) => order.grantedAt ? "Plus · Selamanya aktif" : ({
  deny: "Pembayaran ditolak", cancel: "Pembayaran dibatalkan", expire: "Pembayaran kedaluwarsa", failure: "Pembayaran gagal",
} as Record<string, string>)[order.status] ?? "Menunggu konfirmasi pembayaran";
export const finishedPayment = (order: PaymentOrder) => !!order.grantedAt || ["deny", "cancel", "expire", "failure"].includes(order.status);

export function Plus() {
  const acc = useAccount();
  const userId = acc.token ? acc.me?.user.id : undefined;
  return <PlusAccount key={userId ?? "guest"} userId={userId} active={acc.me?.entitlement.plan === "plus_lifetime" && !!acc.token} />;
}

function PlusAccount({ userId, active }: { userId?: string; active: boolean }) {
  const key = `bb_payment:${userId}`;
  const [orderId, setOrderId] = useState(() => userId ? localStorage.getItem(key) : null);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!userId || !orderId || active) return;
    let cancelled = false, timer: ReturnType<typeof setTimeout>;
    const until = Date.now() + 60_000;
    async function check() {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        const { data } = await api<PaymentOrder>(`/billing/orders/${encodeURIComponent(orderId!)}`);
        if (cancelled) return;
        setOrder(data); setError("");
        if (data.grantedAt) await refreshMe();
        if (finishedPayment(data)) return;
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof ApiError && e.status === 404 ? "Order tidak ditemukan untuk akun ini." : "Belum bisa memeriksa pembayaran. Cek koneksi lalu coba lagi.");
        return;
      }
      if (!cancelled && Date.now() < until) timer = setTimeout(check, 5000);
    }
    const visible = () => { clearTimeout(timer); if (Date.now() < until) void check(); };
    document.addEventListener("visibilitychange", visible);
    void check();
    return () => { cancelled = true; clearTimeout(timer); document.removeEventListener("visibilitychange", visible); };
  }, [userId, orderId, active, round]);

  async function checkout() {
    if (lock.current || active || !userId) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const { data } = await api<{ orderId: string; redirectUrl: string }>("/billing/lifetime", { method: "POST", body: "{}" });
      const url = new URL(data.redirectUrl);
      if (url.protocol !== "https:" || url.hostname !== "app.sandbox.midtrans.com") throw new Error("invalid_checkout");
      localStorage.setItem(key, data.orderId);
      setOrderId(data.orderId);
      location.assign(url.href);
    } catch (e) {
      if (e instanceof ApiError && e.code === "already_plus") await refreshMe().catch(() => {});
      setError(e instanceof ApiError && e.code === "billing_unconfigured" ? "Pembayaran sandbox belum dikonfigurasi. Coba lagi setelah server siap."
        : e instanceof ApiError && e.code === "production_disabled" ? "Pembayaran asli belum diaktifkan. Gunakan sandbox."
        : "Checkout belum bisa dibuka. Cek koneksi lalu coba lagi.");
      lock.current = false; setBusy(false);
    }
  }

  return <>
    <TopBar title="Plus" back="#/profil" />
    <section className="card solid stack">
      <span className="pill plus-chip">Uji pembayaran sandbox</span>
      <h1>{active ? "Plus · Selamanya" : "Plus Selamanya"}</h1>
      <p className="muted">{active ? "Pembayaran sandbox sudah dikonfirmasi server." : "Uji alur pembayaran sekali untuk Selamanya. Tidak ada pembayaran uang nyata."}</p>
      <p className="muted">Fitur Plus sedang disiapkan. Catatan offline, sinkron, dan pasangan tetap Free.</p>
      {error && <p role="alert" className="signin-error">{error}</p>}
      {order && <p role="status">{paymentLabel(order)}</p>}
      {!userId ? <a className="btn btn-ink block" href="#/masuk-akun" onClick={() => sessionStorage.setItem("bb_auth_return", "#/plus")}>Masuk atau daftar untuk lanjut</a>
        : !active && <button className="btn btn-coral block" disabled={busy || !!orderId && (!order || !finishedPayment(order))} aria-busy={busy} onClick={checkout}>{busy ? "Menyiapkan checkout…" : "Lanjut ke pembayaran sandbox"}</button>}
      {userId && orderId && !active && <button className="btn btn-soft block" onClick={() => setRound((r) => r + 1)}>Cek lagi</button>}
      <a className="link-btn" href="#/">Kembali ke catatan</a>
    </section>
  </>;
}
