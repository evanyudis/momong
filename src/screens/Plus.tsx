import { Baby, Bell, ChartNoAxesColumn, Clock, FileText, Gift, Milk } from "lucide-react";
import { PlusMesh } from "../PlusMesh";
import { PLUS_ENABLED } from "../release";
import { useEffect, useRef, useState } from "react";
import { ApiError, api, refreshMe, useAccount } from "../sync";
import { reducedMotion } from "../motion";
import { PLUS_FEATURES } from "../content";
import { isPlus } from "../store";
import { PlanPicker, selectedPlan } from "../billing";
import { PlusBadge, TopBar } from "../ui";
import { encode } from "uqr";
import { blocksCheckout, checkoutErrorCode, checkoutErrorCopy, checkoutRequest, expiredPayment, finishedPayment, orderNotice, paymentLabel, planAvailable, readConsent, sumopodPaymentLink, sumopodPlans, writeConsent, type PaymentOrder } from "../checkout";

export { MONTHLY_CONSENT_VERSION } from "../checkout";
export const TERMS_HREF = "#/syarat-ketentuan";

export { finishedPayment, paymentLabel, type PaymentOrder } from "../checkout";

/** QRIS dari paymentCode saat Sumopod tidak memberi link hosted. Warna terang tetap (invite-qr) supaya tema gelap tidak membalik kode. */
function PaymentQr({ value }: { value: string }) {
  const qr = encode(value, { ecc: "M", border: 4 });
  const n = qr.size;
  return <svg className="invite-qr" viewBox={`0 0 ${n} ${n}`} role="img" aria-label="Kode QRIS pembayaran">
    <rect width={n} height={n} fill="var(--surface)" />
    {qr.data.flatMap((row, y) => row.map((on, x) => on ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" /> : null))}
  </svg>;
}

function FeatureIcon({ index }: { index: number }) {
  const Icon = FEATURE_ICONS[index];
  return <span className="plus-feature-icon" aria-hidden="true"><Icon size={22} /></span>;
}

const FEATURE_ICONS = [Milk, Bell, ChartNoAxesColumn, Clock, FileText, Gift, Baby];

export function Plus() {
  return <div className="plus-page"><div className="plus-page-backdrop" aria-hidden="true"><PlusMesh /></div><PlusContent /></div>;
}

function PlusContent() {
  const acc = useAccount();
  if (acc.me?.entitlement.earlyAccess && isPlus()) return <>
    <TopBar title={acc.me.entitlement.plan === "plus_lifetime" ? "Plus · Lifetime" : "Plus · Trial"} back="#/profil" />
    <div className="stack">
      <section className="card plus-glass plus-hero stack"><PlusBadge size="medium" /><h1>Early access kamu aktif.</h1>
        <p>{acc.me.entitlement.plan === "plus_lifetime" ? "Akses Plus gratis tanpa batas waktu." : <>Gratis sampai {new Date(acc.me.entitlement.expiresAt!).toLocaleDateString("id-ID", { dateStyle: "long" })}.</>} Tidak ada tagihan atau perpanjangan otomatis. Akses berlaku untuk household kamu.</p>
      </section>
      <section className="card plus-glass stack"><h2>Fitur Plus</h2>
        <ul className="plus-page-features">{PLUS_FEATURES.map((feature, i) => <li key={feature.title}><FeatureIcon index={i} /><div><h3>{feature.title}</h3><p className="muted">{feature.body}</p><a className="link-btn" href={["#/insight", "#/pengingat", "#/insight", "#/log", "#/laporan", "#/kado", "#/profil"][i]}>Buka fitur</a></div></li>)}</ul>
      </section>
    </div>
  </>;
  if (!PLUS_ENABLED) return <>
    <TopBar title="Momong Plus" back="#/profil" />
    <div className="stack">
      <section className="card plus-glass plus-hero stack"><PlusBadge size="medium" />
        <h1>Grafik, riwayat lengkap, dan laporan.</h1>
        <p>Momong Plus sedang disiapkan. Kamu bisa terus memakai fitur gratis, termasuk sinkronisasi dan akses pasangan.</p>
        <button className="btn btn-coral lg block" disabled>Segera hadir</button>
      </section>
      <section className="card plus-glass stack">
        <h2>Yang sedang kami siapkan</h2>
        <ul className="plus-page-features">{PLUS_FEATURES.map((feature, i) => <li key={feature.title}>
          <FeatureIcon index={i} />
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
  const [consent, setConsentState] = useState(() => readConsent(sessionStorage, userId, "monthly"));
  const setConsent = (value: boolean) => { writeConsent(sessionStorage, userId, "monthly", value); setConsentState(value); };
  const [online, setOnline] = useState(navigator.onLine);
  const [plans, setPlans] = useState<any>(null);
  const [plansFailed, setPlansFailed] = useState(false);
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
    void api<any>("/billing/plans").then(({ data }) => { if (!cancelled) { setPlans(data); setPlansFailed(false); } }).catch(() => { if (!cancelled) { setPlansFailed(true); setError("Konfigurasi pembayaran belum bisa dimuat. Cek koneksi lalu coba lagi."); } });
    if (userId) void api<any>("/billing/account").then(({ data }) => {
      if (cancelled) return; setBilling(data);
      const pending = data.orders.find((o: PaymentOrder) => blocksCheckout(o));
      if (pending) { localStorage.setItem(key, pending.orderId); setOrderId(pending.orderId); setPlan(pending.plan === "monthly" ? "monthly" : "plus_lifetime"); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId, round, online]);
  const qris = sumopodPlans(plans);
  const available = planAvailable(plans, plan);



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
        // Kunci idempotensi yang ordernya gagal/kedaluwarsa dijawab checkout_expired oleh server; checkout baru butuh kunci baru.
        else if (finishedPayment(data)) idempotency.current = crypto.randomUUID();
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
      const request = checkoutRequest(plan, idempotency.current);
      const { data } = await api<{ orderId: string; grossAmount?: number; redirectUrl?: string; paymentCode?: string }>(request.path, { method: "POST", body: JSON.stringify(request.body) });
      if (data.orderId) { localStorage.setItem(key, data.orderId); setOrderId(data.orderId); }
      const url = sumopodPaymentLink(data.redirectUrl);
      if (url) {
        writeConsent(sessionStorage, userId, "monthly", false);
        location.assign(url.href);
        return;
      }
      // Respons QR saja: tampilkan QRIS di halaman ini dan pantau statusnya, jangan kunci checkout 24 jam.
      if (!data.orderId || !data.paymentCode) throw new Error("invalid_checkout");
      writeConsent(sessionStorage, userId, "monthly", false); setConsentState(false);
      setOrder({ orderId: data.orderId, status: "pending", grantedAt: null, plan, paymentCode: data.paymentCode });
      lock.current = false; setBusy(false);
    } catch (e) {
      const code = e instanceof ApiError ? checkoutErrorCode(e.status, e.code) : e instanceof Error ? e.message : undefined;
      if (code === "already_plus") await refreshMe().catch(() => {});
      // Order gagal/kedaluwarsa dijawab checkout_expired untuk kunci yang sama; setelah 502 order-nya juga sudah gagal. Kunci baru = satu kali coba lagi cukup.
      if (code === "checkout_expired" || code === "provider_failed") idempotency.current = crypto.randomUUID();
      if (code === "checkout_pending") setRound((r) => r + 1);
      setError(checkoutErrorCopy(code));
      lock.current = false; setBusy(false);
    }
  }

  return <>
    <TopBar title="Plus" back="#/profil" />
    {celebrate && <p className="plus-activation" role="status">Selamat datang di Momong Plus ✦</p>}
    <div className="stack">
      <section className="card plus-glass plus-hero stack"><PlusBadge size="medium" />
        {plans?.sandbox === true && <span className="pill plus-chip">Momong Plus · Sandbox</span>}
        <h1>{active ? "Lebih dekat dengan polanya." : expired ? "Masa Plusmu sudah berakhir." : "Hari kecil. Cerita besar."}</h1>
        <p>{active ? "Semua fitur Plus siap dibuka dari perangkat ini." : expired ? "Catatanmu tetap tersimpan. Periksa perpanjangan atau pilih Lifetime untuk membuka Plus lagi." : "Pahami pola, simpan kenangan, dan bagi persiapan dengan orang tersayang."}</p>
        {active && <p className="plus-membership">{lifetime ? "Plus · Lifetime" : "Plus · Bulanan"}{billing?.shared ? " · Dari pasangan" : ""}</p>}
        {acc.me?.entitlement.expiresAt && <p>Akses hingga {new Date(acc.me.entitlement.expiresAt).toLocaleDateString("id-ID")}</p>}
        {!active && <div className="plus-preview" aria-label="Contoh preview produk">
          <small>CONTOH · POLA MENYUSU</small>
          <div className="spread"><strong>Berikutnya sekitar</strong><span className="num">14.30</span></div>
          <div className="plus-preview-bars" aria-hidden="true">{[35, 55, 42, 75, 60, 82, 68].map((h, i) => <i key={i} style={{ height: h + "%" }} />)}</div>
          <small>Perkiraan non-klinis dari catatan, bukan jadwal wajib.</small>
        </div>}
      </section>
      {!lifetime && !billing?.shared && <section className="card plus-glass stack">
        <h2>{active ? "Pilih Lifetime" : "Pilih yang pas untukmu"}</h2>
        <PlanPicker value={plan} onChange={(p) => { setPlan(p); setConsent(false); }} />
        {active && <p className="muted">Upgrade Lifetime membayar penuh, tanpa prorata. Perpanjangan bulanan dihentikan setelah pembayaran sukses.</p>}
        {plan === "monthly" && <>
          <p className="muted">Bayar lewat QRIS. Link perpanjangan muncul di sini sekitar 3 hari sebelum periode berakhir.</p>
          <label className="plus-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>Saya paham Plus Bulanan Rp39.000 tidak diperpanjang otomatis, dan saya setuju dengan <a className="inline-link" href={TERMS_HREF}>Syarat & Ketentuan</a>.</span>
          </label>
        </>}
        {plan === "plus_lifetime" && <p className="muted">Dengan menekan Konfirmasi, kamu setuju dengan <a className="inline-link" href={TERMS_HREF}>Syarat & Ketentuan</a>.</p>}
        <p className="muted">{!plans ? plansFailed ? "Info pembayaran belum termuat." : "Memuat info pembayaran…" : plans.sandbox === false ? "Pembayaran lewat QRIS, diproses Sumopod." : "Uji pembayaran sandbox. Tidak ada uang nyata yang ditagih."} Sinkron dan pasangan tetap Free.</p>
        {!online && <p role="status">Kamu offline. Status tersimpan tetap bisa dilihat; checkout membutuhkan koneksi.</p>}
        {online && plans && !qris && <p role="status">Pembayaran QRIS belum aktif di server. Coba lagi nanti.</p>}
        {online && plans && qris && !available && <p role="status">Paket ini belum bisa dibayar. Pilih paket lain atau coba lagi setelah konfigurasi siap.</p>}
        <button className="btn btn-coral lg block" disabled={busy || !online || !available || active && billing?.shared || plan === "monthly" && (!consent || active) || !!orderId && (!order || blocksCheckout(order))} aria-busy={busy} onClick={checkout}>
          {busy ? "Menyiapkan checkout…" : "Konfirmasi · " + (plan === "monthly" ? "Rp39.000/bulan" : "Rp199.000 Lifetime")}
        </button>
      </section>}
      {error && <div className="stack"><p role="alert" className="signin-error">{error}</p><button className="btn btn-soft block" onClick={() => setRound((r) => r + 1)}>Coba lagi</button></div>}
      {order && <section className="card plus-glass stack"><p role="status">{paymentLabel(order)}</p>
        {orderNotice(order) && <p className="muted">{orderNotice(order)}</p>}
        {!finishedPayment(order) && <p className="muted">Akses aktif setelah pembayaran dikonfirmasi server.</p>}
        {!finishedPayment(order) && sumopodPaymentLink(order.redirectUrl) && <a className="btn btn-coral block" href={sumopodPaymentLink(order.redirectUrl)!.href}>Buka link pembayaran</a>}
        {!finishedPayment(order) && !sumopodPaymentLink(order.redirectUrl) && order.paymentCode && <><PaymentQr value={order.paymentCode} /><p className="muted">Pindai QRIS ini dari aplikasi bank atau e-wallet.</p></>}
        {expiredPayment(order) && <p className="muted">Link ini sudah tidak bisa dipakai. Pilih paket lalu tekan Konfirmasi untuk membuat link baru.</p>}
        {userId && orderId && !lifetime && <button className="btn btn-soft block" onClick={() => setRound((r) => r + 1)}>Cek lagi</button>}
      </section>}
      <section className="card plus-glass stack">
        <h2>{active ? "Plus kamu, siap dipakai" : "Ruang lebih untuk setiap tahap"}</h2>
        <ul className="plus-page-features">{PLUS_FEATURES.map((feature, i) => <li key={feature.title}>
          <FeatureIcon index={i} />
          <div><h3>{feature.title}</h3><p className="muted">{feature.body}</p>
            {active && <a className="link-btn" href={["#/insight", "#/pengingat", "#/insight", "#/log", "#/laporan", "#/kado", "#/profil"][i]}>Buka fitur</a>}
          </div></li>)}</ul>
      </section>
      {billing?.subscriptions?.map((sub: any) => <section className="card plus-glass stack" key={sub.id}>
        <h2>Perpanjangan bulanan</h2>
        <p>{({ active: "Aktif", provisioning: "Menyiapkan perpanjangan", cancel_pending: "Perpanjangan sedang dihentikan", cancelled: "Perpanjangan dihentikan", attention: "Perlu pemeriksaan pembayaran", inactive: "Perpanjangan gagal" } as Record<string, string>)[sub.state] ?? sub.state}</p>
        {sub.periodEnd && <p className="muted">Periode dibayar hingga {new Date(sub.periodEnd).toLocaleDateString("id-ID")}. Menghentikan perpanjangan tidak menghapus akses periode ini.</p>}
        {sub.lastError && <p role="status">Perpanjangan belum siap. Pembayaran periode ini tetap berlaku.</p>}
        {!["cancelled", "cancel_pending"].includes(sub.state) && <button className="btn btn-soft block" disabled={busy || !online} onClick={async () => {
          if (lock.current) return; lock.current = true; setBusy(true);
          try { await api("/billing/subscriptions/" + encodeURIComponent(sub.id) + "/cancel", { method: "POST", body: "{}" }); setRound((r) => r + 1); }
          catch { setError("Perpanjangan belum berhasil dihentikan. Coba lagi."); }
          finally { lock.current = false; setBusy(false); }
        }}>Hentikan perpanjangan</button>}
      </section>)}
      {!!(billing?.history ?? billing?.orders)?.length && <section className="card plus-glass stack"><h2>Riwayat pembayaran</h2>{(billing.history ?? billing.orders).map((o: PaymentOrder) =>
        <div className="spread" key={o.orderId}><div><strong>{o.plan === "monthly" ? "Bulanan" : "Lifetime"}</strong><p className="muted">{paymentLabel(o)}</p></div>
          <span className="num">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(o.amount ?? 0)}</span></div>)}</section>}
      <a className="btn btn-soft block" href="#/">Kembali ke catatan</a>
    </div>
  </>;
}
