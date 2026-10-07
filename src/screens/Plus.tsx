import { PLUS_ENABLED } from "../release";
import { useEffect, useRef, useState } from "react";
import { ApiError, api, refreshMe, useAccount } from "../sync";
import { reducedMotion } from "../motion";
import { PLUS_FEATURES } from "../content";
import { isPlus } from "../store";
import { PlanPicker, selectedPlan } from "../billing";
import { TopBar } from "../ui";

export type PaymentOrder = { orderId: string; status: string; grantedAt: string | null; plan?: string; amount?: number; createdAt?: string; redirectUrl?: string };
export const paymentLabel = (order: PaymentOrder) => order.grantedAt ? order.plan === "monthly" ? "Plus · Bulanan aktif" : "Plus · Selamanya aktif" : ({
  deny: "Pembayaran ditolak", cancel: "Pembayaran dibatalkan", expire: "Pembayaran kedaluwarsa", failure: "Pembayaran gagal",
} as Record<string, string>)[order.status] ?? "Menunggu konfirmasi pembayaran";
export const finishedPayment = (order: PaymentOrder) => !!order.grantedAt || ["deny", "cancel", "expire", "failure"].includes(order.status);

export function Plus() {
  const acc = useAccount();
  if (acc.me?.entitlement.earlyAccess && isPlus()) return <>
    <TopBar title={acc.me.entitlement.plan === "plus_lifetime" ? "Plus · Selamanya" : "Plus · Trial"} back="#/profil" />
    <div className="stack">
      <section className="card plus-hero stack"><h1>Early access kamu aktif.</h1>
        <p>{acc.me.entitlement.plan === "plus_lifetime" ? "Akses Plus gratis tanpa batas waktu." : <>Gratis sampai {new Date(acc.me.entitlement.expiresAt!).toLocaleDateString("id-ID", { dateStyle: "long" })}.</>} Tidak ada tagihan atau perpanjangan otomatis. Akses berlaku untuk household kamu.</p>
      </section>
      <section className="card solid stack"><h2>Fitur Plus</h2>
        <ul className="plus-page-features">{PLUS_FEATURES.map((feature, i) => <li key={feature.title}><div><h3>{feature.title}</h3><p className="muted">{feature.body}</p><a className="link-btn" href={["#/insight", "#/pengingat", "#/insight", "#/log", "#/laporan", "#/kado", "#/profil"][i]}>Buka fitur</a></div></li>)}</ul>
      </section>
    </div>
  </>;
  if (!PLUS_ENABLED) return <>
    <TopBar title="Momong Plus" back="#/profil" />
    <div className="stack">
      <section className="card plus-hero stack">
        <h1>Grafik, riwayat lengkap, dan laporan.</h1>
        <p>Momong Plus sedang disiapkan. Kamu bisa terus memakai fitur gratis, termasuk sinkronisasi dan akses pasangan.</p>
        <button className="btn btn-coral lg block" disabled>Segera hadir</button>
      </section>
      <section className="card solid stack">
        <h2>Yang sedang kami siapkan</h2>
        <ul className="plus-page-features">{PLUS_FEATURES.map((feature, i) => <li key={feature.title}>
          <span className="plus-feature-number" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
          <div><h3>{feature.title}</h3><p className="muted">{feature.body}</p></div>
        </li>)}</ul>
      </section>
    </div>
  </>;
  return <PlusEnabled />;
}

function PlusEnabled() {
  const acc = useAccount();
  const userId = acc.token ? acc.me?.user.id : undefined;
  return <PlusAccount key={userId ?? "guest"} userId={userId} active={isPlus() && !!acc.token} />;
}

function PlusAccount({ userId, active }: { userId?: string; active: boolean }) {
  const acc = useAccount();
  const [celebrate, setCelebrate] = useState(false);
  const keyboard = useRef(!!document.activeElement?.matches(":focus-visible"));
  const [plan, setPlan] = useState(selectedPlan);
  const [method, setMethod] = useState("credit_card");
  const [consent, setConsent] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [plans, setPlans] = useState<any>(null);
  const [billing, setBilling] = useState<any>(null);
  const idempotency = useRef(crypto.randomUUID());
  const lifetime = acc.me?.entitlement.plan === "plus_lifetime";
  const expired = acc.me?.entitlement.plan === "monthly" && !active;
  const key = `bb_payment:${userId}`;
  const [orderId, setOrderId] = useState(() => userId ? localStorage.getItem(key) : null);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [round, setRound] = useState(0);
  useEffect(() => {
    const key = () => { keyboard.current = true; }, pointer = () => { keyboard.current = false; };
    addEventListener("keydown", key); addEventListener("pointerdown", pointer);
    return () => { removeEventListener("keydown", key); removeEventListener("pointerdown", pointer); };
  }, []);
  useEffect(() => {
    if (!active || !userId || !acc.verifiedAt) return;
    const marker = `bb_activation:${userId}:${acc.me?.entitlement.plan}:${acc.me?.entitlement.expiresAt ?? "lifetime"}`;
    if (localStorage.getItem(marker)) return;
    localStorage.setItem(marker, "1");
    if (reducedMotion() || keyboard.current) return;
    setCelebrate(true);
    const timer = setTimeout(() => setCelebrate(false), 1000);
    return () => clearTimeout(timer);
  }, [active, userId, acc.verifiedAt, acc.me?.entitlement.plan, acc.me?.entitlement.expiresAt]);

  useEffect(() => {
    const changed = () => setOnline(navigator.onLine);
    addEventListener("online", changed); addEventListener("offline", changed);
    return () => { removeEventListener("online", changed); removeEventListener("offline", changed); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    void api<any>("/billing/plans").then(({ data }) => { if (!cancelled) setPlans(data); }).catch(() => { if (!cancelled) setError("Konfigurasi pembayaran belum bisa dimuat. Cek koneksi lalu coba lagi."); });
    if (userId) void api<any>("/billing/account").then(({ data }) => {
      if (cancelled) return; setBilling(data);
      const pending = data.orders.find((o: PaymentOrder) => !finishedPayment(o));
      if (pending) { localStorage.setItem(key, pending.orderId); setOrderId(pending.orderId); setPlan(pending.plan === "monthly" ? "monthly" : "plus_lifetime"); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId, round, online]);
  const available = plan === "plus_lifetime" ? plans?.plans?.find((p: any) => p.id === plan)?.available :
    plans?.plans?.find((p: any) => p.id === plan)?.methods?.find((m: any) => m.id === method)?.available;



  useEffect(() => {
    if (!userId || !orderId || lifetime) return;
    let cancelled = false, timer: ReturnType<typeof setTimeout>;
    const until = Date.now() + 60_000;
    async function check() {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        const { data } = await api<PaymentOrder>(`/billing/orders/${encodeURIComponent(orderId!)}?refresh=1`);
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
  }, [userId, orderId, lifetime, round]);

  async function checkout() {
    if (lock.current || lifetime || !userId || !online || !available || active && billing?.shared || plan === "monthly" && (!consent || active)) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const { data } = await api<{ orderId: string; redirectUrl: string }>(plan === "monthly" ? "/billing/monthly" : "/billing/lifetime", { method: "POST", body: JSON.stringify(plan === "monthly" ? { method, consent, idempotencyKey: idempotency.current } : {}) });
      const url = new URL(data.redirectUrl);
      if (url.protocol !== "https:" || url.hostname !== "app.sandbox.midtrans.com") throw new Error("invalid_checkout");
      localStorage.setItem(key, data.orderId);
      setOrderId(data.orderId);
      location.assign(url.href);
    } catch (e) {
      if (e instanceof ApiError && e.code === "already_plus") await refreshMe().catch(() => {});
      setError(e instanceof ApiError && e.code === "billing_unconfigured" ? "Pembayaran sandbox belum dikonfigurasi. Coba lagi setelah server siap."
        : e instanceof ApiError && e.code === "production_disabled" ? "Pembayaran asli belum diaktifkan. Gunakan sandbox."
        : e instanceof ApiError && e.code === "subscription_exists" ? "Masih ada langganan bulanan. Kelola atau batalkan perpanjangan di bawah sebelum membuat langganan baru."
        : e instanceof ApiError && e.code === "checkout_pending" ? "Order sebelumnya sedang diperiksa. Cek status sebelum memulai pembayaran lain."
        : "Checkout belum bisa dibuka. Cek koneksi lalu coba lagi.");
      lock.current = false; setBusy(false);
    }
  }

  return <>
    <TopBar title="Plus" back="#/profil" />
    {celebrate && <p className="plus-activation" role="status">Selamat datang di Momong Plus ✦</p>}
    <div className="stack">
      <section className="card plus-hero stack">
        <span className="pill plus-chip">Momong Plus · Sandbox</span>
        <h1>{active ? lifetime ? "Selamanya bersama si kecil." : "Lebih dekat dengan polanya." : expired ? "Masa Plusmu sudah berakhir." : "Hari kecil. Cerita besar."}</h1>
        <p>{active ? "Semua fitur Plus siap dibuka dari perangkat ini." : expired ? "Catatanmu tetap tersimpan. Periksa perpanjangan atau pilih Selamanya untuk membuka Plus lagi." : "Pahami pola, simpan kenangan, dan bagi persiapan dengan orang tersayang."}</p>
        {active && <p className="plus-membership">{lifetime ? "Plus · Selamanya" : "Plus · Bulanan"}{billing?.shared ? " · Dari pasangan" : ""}</p>}
        {acc.me?.entitlement.expiresAt && <p>Akses hingga {new Date(acc.me.entitlement.expiresAt).toLocaleDateString("id-ID")}</p>}
        {!active && <div className="plus-preview" aria-label="Contoh preview produk">
          <small>CONTOH · POLA MENYUSU</small>
          <div className="spread"><strong>Berikutnya sekitar</strong><span className="num">14.30</span></div>
          <div className="plus-preview-bars" aria-hidden="true">{[35, 55, 42, 75, 60, 82, 68].map((h, i) => <i key={i} style={{ height: h + "%" }} />)}</div>
          <small>Perkiraan non-klinis dari catatan, bukan jadwal wajib.</small>
        </div>}
      </section>
      {!lifetime && !billing?.shared && <section className="card solid stack">
        <h2>{active ? "Pilih Selamanya" : "Pilih yang pas untukmu"}</h2>
        <PlanPicker value={plan} onChange={(p) => { setPlan(p); setConsent(false); }} />
        {active && <p className="muted">Upgrade Selamanya membayar penuh, tanpa prorata. Perpanjangan bulanan dihentikan setelah pembayaran sukses.</p>}
        {plan === "monthly" && <>
          <label className="field"><span>Metode pembayaran</span><select className="input" value={method} onChange={(e) => { setMethod(e.target.value); setConsent(false); }}>
            <option value="credit_card">Kartu</option><option value="gopay">GoPay</option>
          </select></label>
          <label className="plus-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>Saya setuju perpanjangan otomatis Rp39.000 setiap bulan. Bisa dibatalkan; akses berlaku sampai akhir periode yang dibayar. Tanpa trial atau grace period.</span>
          </label>
        </>}
        <p className="muted">Uji pembayaran sandbox. Tidak ada uang nyata yang ditagih. Sinkron dan pasangan tetap Free.</p>
        {!online && <p role="status">Kamu offline. Status tersimpan tetap bisa dilihat; checkout membutuhkan koneksi.</p>}
        {online && plans && !available && <p role="status">Metode sandbox ini belum diaktifkan. Pilih paket lain atau coba lagi setelah konfigurasi siap.</p>}
        <button className="btn btn-coral lg block" disabled={busy || !online || !available || active && billing?.shared || plan === "monthly" && (!consent || active) || !!orderId && (!order || !finishedPayment(order))} aria-busy={busy} onClick={checkout}>
          {busy ? "Menyiapkan checkout…" : "Konfirmasi · " + (plan === "monthly" ? "Rp39.000/bulan" : "Rp199.000 Selamanya")}
        </button>
      </section>}
      {error && <div className="stack"><p role="alert" className="signin-error">{error}</p><button className="btn btn-soft block" onClick={() => setRound((r) => r + 1)}>Coba lagi</button></div>}
      {order && <section className="card solid stack"><p role="status">{paymentLabel(order)}</p>
        {!finishedPayment(order) && <p className="muted">Akses aktif setelah pembayaran dikonfirmasi server.</p>}
        {userId && orderId && !lifetime && <button className="btn btn-soft block" onClick={() => setRound((r) => r + 1)}>Cek lagi</button>}
      </section>}
      <section className="card solid stack">
        <h2>{active ? "Plus kamu, siap dipakai" : "Ruang lebih untuk setiap tahap"}</h2>
        <ul className="plus-page-features">{PLUS_FEATURES.map((feature, i) => <li key={feature.title}>
          <span className="plus-feature-number" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
          <div><h3>{feature.title}</h3><p className="muted">{feature.body}</p>
            {active && <a className="link-btn" href={["#/insight", "#/pengingat", "#/insight", "#/log", "#/laporan", "#/kado", "#/profil"][i]}>Buka fitur</a>}
          </div></li>)}</ul>
      </section>
      {billing?.subscriptions?.map((sub: any) => <section className="card solid stack" key={sub.id}>
        <h2>Perpanjangan bulanan</h2>
        <p>{({ active: "Aktif", provisioning: "Menyiapkan perpanjangan", cancel_pending: "Pembatalan sedang diproses", cancelled: "Perpanjangan dibatalkan", attention: "Perlu pemeriksaan pembayaran", inactive: "Perpanjangan gagal" } as Record<string, string>)[sub.state] ?? sub.state}</p>
        {sub.periodEnd && <p className="muted">Periode dibayar hingga {new Date(sub.periodEnd).toLocaleDateString("id-ID")}. Pembatalan tidak menghapus akses periode ini.</p>}
        {sub.lastError && <p role="status">Perpanjangan belum siap. Pembayaran periode ini tetap berlaku.</p>}
        {!["cancelled", "cancel_pending"].includes(sub.state) && <button className="btn btn-soft block" disabled={busy || !online} onClick={async () => {
          if (lock.current) return; lock.current = true; setBusy(true);
          try { await api("/billing/subscriptions/" + encodeURIComponent(sub.id) + "/cancel", { method: "POST", body: "{}" }); setRound((r) => r + 1); }
          catch { setError("Pembatalan belum berhasil. Coba lagi."); }
          finally { lock.current = false; setBusy(false); }
        }}>Batalkan perpanjangan</button>}
      </section>)}
      {!!(billing?.history ?? billing?.orders)?.length && <section className="card solid stack"><h2>Riwayat pembayaran</h2>{(billing.history ?? billing.orders).map((o: PaymentOrder) =>
        <div className="spread" key={o.orderId}><div><strong>{o.plan === "monthly" ? "Bulanan" : "Selamanya"}</strong><p className="muted">{paymentLabel(o)}</p></div>
          <span className="num">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(o.amount ?? 0)}</span></div>)}</section>}
      <a className="btn btn-soft block" href="#/">Kembali ke catatan</a>
    </div>
  </>;
}
