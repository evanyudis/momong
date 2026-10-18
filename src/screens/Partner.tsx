import { Check, CloudOff, LoaderCircle, LogOut, Mail, MessageCircle, QrCode, RefreshCw, UserRound, UserRoundPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Form, Input, Label, TextField } from "react-aria-components";
import { encode } from "uqr";
import { agoLabel } from "../dates";
import { initial, partnerSyncScreen, useHousehold } from "../household";
import {
  claimJoinClick, clearInvite, displayInviteCode, externalBrowserHref, googleChoiceResume, inviteEntry, inviteLinkWithOwner, inviteOwnerName, inviteReturnHash, inviteShowsGoogleError, inviteTokenFromInput, inviteWasSent,
  isAndroid, isInviteToken, isSafeInviteReturn, isWhatsAppBrowser, joinConfirmCopy, joinDataWarning, joinFailureMessage, markInviteSent, navigationType, pairStepLabel, pairSteps, readInvite, readInviteName, reconcilePendingInvite, rememberInvite, shouldClearStaleGoogle,
} from "../invite";
import { go } from "../route";
import { getPrefs, setPrefs } from "../store";
import {
  HAS_API, setSyncEnabled, abandonGoogleStart, ApiError, acceptInvite, consumePendingInvite, createInvite, googlePhase, removeMember, takeGoogleReturn,
  requestMagicLink, signOut, startGoogle, syncNow, refreshMe, useAccount, authDestination, verifyMagicLink, type HouseholdInvite,
} from "../sync";
import { Sheet, toast, TopBar } from "../ui";

// A magic-link token is single-use; dedupe so a re-run effect can't burn it twice.
const verifying = new Map<string, Promise<void>>();

function localRecordCount() {
  try {
    const db = JSON.parse(localStorage.getItem("bb_db_v1") || "{}") as Record<string, Record<string, unknown>>;
    return Object.values(db).reduce((sum, records) => sum + (records && typeof records === "object" ? Object.keys(records).length : 0), 0);
  } catch {
    return 0;
  }
}

function JoinDataNote() {
  const cursor = Number(localStorage.getItem("bb_cursor") ?? 0);
  const note = joinDataWarning({ localRecords: localRecordCount(), syncCursor: Number.isFinite(cursor) ? cursor : 0 });
  if (!note) return null;
  return <p className="wa-banner" role="status" style={{ margin: 0 }}>{note}</p>;
}

export function SyncDot() {
  const acc = useAccount();
  const map = {
    local: ["var(--ink-faint)", "Hanya di HP ini"],
    offline: ["var(--warning)", "Offline · tersimpan di HP"],
    syncing: ["var(--accent-primary)", "Menyinkron…"],
    synced: ["var(--success)", `Tersinkron · ${acc.lastSyncAt ? agoLabel(acc.lastSyncAt) : ""}`],
    error: ["var(--warning)", "Belum tersinkron · coba lagi"],
  } as const;
  const status = !acc.syncEnabled ? "local" : acc.status;
  const [color, text] = map[status];
  return (
    <span className="row" style={{ gap: 6, color: status === "synced" ? "var(--success-ink)" : "var(--ink-muted)", fontWeight: 500 }}>
      {status === "syncing" ? <LoaderCircle size={14} className="sync-busy" aria-hidden="true" /> : status === "synced" ? <Check size={14} aria-hidden="true" /> : status === "local" ? null : <span className="dot" style={{ background: color }} />}{text}
    </span>
  );
}

export function Partner() {
  const h = useHousehold();
  const [joinOpen, setJoinOpen] = useState(false);
  const userId = h.me?.user.id ?? null;
  const rawFlag = userId ? localStorage.getItem(`bb_sync_enabled:${userId}`) : null;
  const storedFlag = rawFlag === "true" ? true : rawFlag === "false" ? false : null;
  const view = !HAS_API ? "no-server" : partnerSyncScreen({
    hasToken: !!h.acc.token,
    userId,
    enabledFlag: h.acc.syncEnabled ? true : storedFlag,
    syncCursor: Number(localStorage.getItem("bb_cursor") ?? 0),
  });
  return (
    <>
      <TopBar title="Pasangan" />
      {view === "no-server" ? <NoServer /> : view === "signin" ? <SignIn /> : view === "wait" ? <div className="card solid empty" role="status" aria-busy="true"><strong>Memeriksa sesi…</strong></div> : view === "household" ? <Household onJoin={() => setJoinOpen(true)} /> : <SyncConsent paired={!!h.partner} onJoin={() => setJoinOpen(true)} />}
      {h.signedIn && <JoinCodeSheet open={joinOpen} onOpenChange={setJoinOpen} />}
    </>
  );
}

function SyncConsent({ paired, onJoin }: { paired: boolean; onJoin: () => void }) {
  return <section className="card solid stack">
    <h1>Aktifkan sinkron?</h1>
    <p className="muted">Catatan di HP ini akan diunggah dan digabung dengan catatan keluarga di akunmu. Sinkron dan pasangan gratis untuk 2 orang.</p>
    <button className="btn btn-ink block" onClick={() => setSyncEnabled(true)}>Aktifkan sinkron</button>
    {!paired && <button className="btn btn-soft block" onClick={onJoin}>Punya kode dari pasangan?</button>}
    <a className="btn btn-soft block" href="#/profil">Nanti saja</a>
  </section>;
}

function Hero({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="avatars" aria-hidden="true">
        <span className="avatar xl blue"><UserRound size={40} /></span>
        <span className="avatar xl coral"><UserRoundPlus size={40} /></span>
      </div>
      <h1 style={{ fontSize: 34, letterSpacing: "-0.03em", lineHeight: 1.1, marginTop: 22 }}>{title}</h1>
      <p className="muted" style={{ fontSize: 17, marginTop: 12, lineHeight: 1.5 }}>{body}</p>
    </div>
  );
}

function NoServer() {
  return (
    <>
      <Hero title="Ajak pasangan mencatat bersama" body="Berdua lebih ringan. Catat dari HP masing-masing, gratis untuk 2 orang." />
      <div className="card solid">
        <div className="row"><CloudOff size={22} className="muted" /><div className="card-title">Sinkron belum aktif</div></div>
        <p className="muted" style={{ marginTop: 8 }}>Server sinkron belum tersambung di versi ini. Semua catatan tetap aman di HP ini.</p>
      </div>
    </>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      await requestMagicLink(email.trim());
      setState("sent");
    } catch {
      setState("error");
    }
  }
  return (
    <>
      <Hero
        title="Ajak pasangan mencatat bersama"
        body="Berdua lebih ringan. Masuk dengan email untuk sinkron dan undang pasangan. Gratis untuk 2 orang."
      />
      {state === "sent" ? (
        <div className="card solid" role="status">
          <div className="row"><span className="glyph blue" style={{ width: 40, height: 40 }}><Mail size={20} /></span><div className="card-title">Cek email kamu</div></div>
          <p className="muted" style={{ marginTop: 10 }}>Kami kirim tautan masuk ke <strong style={{ color: "var(--ink)" }}>{email}</strong>. Buka dari HP ini. Berlaku 15 menit.</p>
          <button className="link-btn" onClick={() => setState("idle")}>Ganti email</button>
        </div>
      ) : (
        <form className="card solid stack" onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input className="input" type="email" required autoComplete="email" inputMode="email" placeholder="nama@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {state === "error" && <p role="alert" style={{ color: "var(--field-danger)", fontSize: 15 }}>Tautan belum terkirim. Cek koneksi lalu coba lagi.</p>}
          <button className="btn btn-blue lg block" disabled={state === "sending"}>{state === "sending" ? "Mengirim…" : "Kirim tautan masuk"}</button>
          <p className="faint" style={{ fontSize: 13, textAlign: "center" }}>Tanpa kata sandi. Catatan tetap tersimpan di HP walau offline.</p>
        </form>
      )}
    </>
  );
}

function PairStatus({ inviteSent }: { inviteSent: boolean }) {
  const h = useHousehold();
  const steps = pairSteps({
    inviteSent,
    hasPartner: !!h.partner,
    syncEnabled: h.acc.syncEnabled,
    syncStatus: h.acc.status,
  });
  return (
    <section className="card solid">
      <span className="label" style={{ fontWeight: 600 }}>Status pasangan</span>
      <ol className="pair-steps" aria-live="polite" aria-label="Status pasangan">
        {steps.map((step, index) => (
          <li key={step.id} data-state={step.state} aria-current={step.state === "current" ? "step" : undefined}>
            <span className="mark" aria-hidden="true">{step.state === "done" ? <Check size={16} /> : index + 1}</span>
            <span className="grow">
              <span className="title">{step.label}</span>
              <span className="sub">{pairStepLabel(step.state)}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function InviteQr({ value }: { value: string }) {
  const qr = encode(value, { ecc: "M", border: 2 });
  const n = qr.size;
  return (
    <svg className="invite-qr" viewBox={`0 0 ${n} ${n}`} role="img" aria-label="Kode QR undangan">
      <rect width={n} height={n} fill="var(--surface)" />
      {qr.data.flatMap((row, y) => row.map((on, x) => on ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" /> : null))}
    </svg>
  );
}

function Household({ onJoin }: { onJoin: () => void }) {
  const h = useHousehold();
  const householdId = h.me?.household.id ?? "";
  useEffect(() => { void refreshMe().catch(() => {}); }, []);
  const previousPartner = useRef(h.partner?.id);
  const [joinedPartner, setJoinedPartner] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  useEffect(() => { setSent(inviteWasSent(householdId)); }, [householdId]);
  useEffect(() => {
    if (!previousPartner.current && h.partner) setJoinedPartner(h.partner.id);
    previousPartner.current = h.partner?.id;
  }, [h.partner?.id]);
  useEffect(() => {
    const pull = () => { void refreshMe().catch(() => {}); void syncNow(); };
    const id = setInterval(pull, h.partner ? 15000 : 5000);
    return () => clearInterval(id);
  }, [h.partner]);
  const [invite, setInvite] = useState<HouseholdInvite | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState(false);
  const [inviteAttempt, setInviteAttempt] = useState(0);
  const full = h.seatsUsed >= h.seats;

  useEffect(() => {
    if (full || !h.isOwner || invite) return;
    let cancelled = false;
    setInviteLoading(true); setInviteError(false);
    createInvite().then((value) => {
      if (!cancelled) { setInvite(value); setInviteLoading(false); }
    }).catch(() => {
      if (!cancelled) { setInviteError(true); setInviteLoading(false); }
    });
    return () => { cancelled = true; };
  }, [full, h.isOwner, invite, inviteAttempt]);

  const code = invite ? displayInviteCode(invite) : "";
  const shareUrl = invite ? inviteLinkWithOwner(invite.url, h.myName) : "";
  const message = invite
    ? `Yuk catat kehamilan & si kecil bareng di Momong. Gabung lewat tautan ini (berlaku 7 hari): ${shareUrl}\n\nAtau buka aplikasi Momong, masuk, lalu tempel kode: ${code}`
    : "";

  function noteSent() {
    if (!householdId) return;
    markInviteSent(householdId);
    setSent(true);
  }

  async function share() {
    if (!invite) return;
    try {
      if (navigator.share) await navigator.share({ title: "Momong", text: message });
      else { await navigator.clipboard.writeText(shareUrl); toast("Tautan undangan disalin. Siap dikirim ke pasangan."); }
      noteSent();
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) toast("Undangan belum dibagikan. Cek izin berbagi lalu coba lagi.", "error");
    }
  }

  async function copyCode() {
    if (!code) return;
    try { await navigator.clipboard.writeText(code); toast("Kode undangan disalin."); }
    catch { toast("Kode belum tersalin. Salin manual dari layar.", "error"); }
  }

  async function revoke(id: string, self: boolean) {
    if (!confirm(self ? "Keluar dari keluarga ini? Catatan di HP ini tetap ada." : `Hapus ${h.partnerName} dari keluarga? Catatan bersama tetap ada.`)) return;
    try { await removeMember(id); setInvite(null); toast(self ? "Kamu sudah keluar dari keluarga. Catatan di HP ini tetap tersimpan." : "Akses pasangan dihapus. Catatan bersama tetap tersimpan."); }
    catch { toast(self ? "Belum bisa keluar dari keluarga. Cek koneksi lalu coba lagi." : "Akses pasangan belum dihapus. Cek koneksi lalu coba lagi.", "error"); }
  }

  const synced = !!h.partner && h.acc.syncEnabled && h.acc.status === "synced";
  const name = getPrefs().name || "Bunda";

  return (
    <>
      {h.partner
        ? <Hero title="Kalian mencatat berdua" body={synced
          ? `Catatan kamu dan ${h.partnerName} tersinkron di kedua HP. Kalian berdua bisa menambah dan mengedit.`
          : `Catatan kamu dan ${h.partnerName} sedang disatukan. Status di bawah ikut berubah.`} />
        : <Hero title="Ajak pasangan mencatat bersama" body="Berdua lebih ringan. Catat kontraksi, gerakan, menyusu, dan popok dari HP masing-masing." />}
      <div className="stack">
        <PairStatus inviteSent={sent} />
        <section className="card solid">
          <div className="spread">
            <span className="label" style={{ fontWeight: 600 }}>Kursi keluarga</span>
            <span className="muted num" style={{ fontSize: 15 }}>{h.seatsUsed} dari {h.seats} terisi</span>
          </div>
          <div className="list" style={{ marginTop: 4 }}>
            <div className="list-row">
              <span className="avatar blue" style={{ width: 48, height: 48, boxShadow: "none" }}>{initial(h.myName || name)}</span>
              <div className="grow">
                <div className="title">Kamu</div>
                <div className="sub">{h.isOwner ? "Pemilik" : "Anggota"} · bisa mengedit</div>
              </div>
              {!h.isOwner && <button className="btn btn-soft sm" onClick={() => revoke(h.me!.user.id, true)}>Keluar</button>}
            </div>
            <div className="list-row">
              {h.partner ? (
                <>
                  <span className={`avatar coral${joinedPartner === h.partner.id ? " row-ack" : ""}`} style={{ width: 48, height: 48, boxShadow: "none" }}>{initial(h.partnerName)}</span>
                  <div className="grow">
                    <div className="title">{h.partnerName}</div>
                    <div className="sub">{h.partner.role === "owner" ? "Pemilik" : "Bergabung"} · bisa mengedit</div>
                  </div>
                  {h.isOwner && <button className="btn btn-danger sm" onClick={() => revoke(h.partner!.id, false)}>Hapus</button>}
                </>
              ) : (
                <>
                  <span className="avatar vacant" style={{ width: 48, height: 48 }}><UserRoundPlus size={20} /></span>
                  <div className="grow">
                    <div className="title">Pasangan</div>
                    <div className="sub">Belum bergabung · bisa mengedit</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="card solid">
          <div className="spread">
            <div>
              <div className="card-title" style={{ fontSize: 16 }}>Sinkron</div>
              <div style={{ fontSize: 14, marginTop: 2 }}><SyncDot /></div>
            </div>
            <button className="btn btn-soft sm" onClick={() => setSyncEnabled(false)}>Matikan sinkron</button>
            <button className="icon-btn" aria-label="Sinkron sekarang" onClick={() => void syncNow()}><RefreshCw size={18} /></button>
          </div>
        </section>

        {!full && h.isOwner && (
          <div className="stack" style={{ marginTop: 12 }}>
            {inviteLoading && !invite && <p role="status">Menyiapkan tautan undangan…</p>}
            {inviteError && <>
              <p role="alert" style={{ color: "var(--field-danger)" }}>Tautan undangan belum bisa dibuat. Cek koneksi lalu coba lagi.</p>
              <button className="btn btn-soft block" onClick={() => setInviteAttempt((n) => n + 1)}>Coba lagi</button>
            </>}
            {invite && (
              <section className="card solid stack">
                <div className="card-title" style={{ fontSize: 16 }}>Kode undangan</div>
                <p className="muted">Pasangan membuka Momong, masuk, lalu menempel kode ini atau memindai QR.</p>
                <InviteQr value={shareUrl} />
                <p className="invite-code">{code}</p>
                <button className="btn btn-soft block" onClick={() => void copyCode()}>Salin kode</button>
              </section>
            )}
            <a
              className="btn btn-blue lg block"
              href={invite ? `https://wa.me/?text=${encodeURIComponent(message)}` : undefined}
              aria-disabled={!invite}
              target="_blank" rel="noreferrer"
              onClick={() => invite && noteSent()}
            >
              <MessageCircle size={22} /> Undang lewat WhatsApp
            </a>
            <button className="btn btn-ghost lg block" onClick={share} disabled={!invite}>Bagikan tautan</button>
            <p className="faint" style={{ fontSize: 14, textAlign: "center" }}>Tautan undangan berlaku 7 hari</p>
          </div>
        )}
        {!full && <button className="btn btn-soft lg block" onClick={onJoin}>Punya kode dari pasangan?</button>}
        {full && (
          <p className="muted" style={{ textAlign: "center", fontSize: 15 }}>Kedua kursi sudah terisi.</p>
        )}

        <button className="link-btn muted" style={{ justifySelf: "center", fontWeight: 500 }} onClick={() => { void signOut(); toast("Sudah keluar dari akun. Catatan tetap tersimpan di HP ini."); }}>
          <LogOut size={16} style={{ marginRight: 6 }} />Keluar akun ({h.me?.user.email})
        </button>
      </div>
    </>
  );
}

function QrScanner({ active, onText }: { active: boolean; onText: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const [error, setError] = useState("");
  useEffect(() => {
    if (!active) return;
    let stop = false;
    let stream: MediaStream | null = null;
    let frame = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stop || !videoRef.current || !ctx) { stream.getTracks().forEach((track) => track.stop()); return; }
        videoRef.current.srcObject = stream;
        videoRef.current.playsInline = true;
        await videoRef.current.play();
        const jsQR = (await import("jsqr")).default;
        const tick = () => {
          if (stop || !videoRef.current) return;
          const video = videoRef.current;
          if (video.readyState >= 2 && video.videoWidth) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(image.data, image.width, image.height);
            if (found?.data) { onTextRef.current(found.data); return; }
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      } catch {
        if (!stop) setError("Kamera tidak bisa dipakai. Tempel kode undangan.");
      }
    })();
    return () => {
      stop = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [active]);
  return (
    <div className="stack">
      <video ref={videoRef} className="qr-video" muted playsInline />
      {error && <p role="alert" style={{ color: "var(--field-danger)" }}>{error}</p>}
    </div>
  );
}

function JoinCodeSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [confirmToken, setConfirmToken] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const joinLock = useRef({ held: false });
  useEffect(() => {
    if (open) return;
    setScanning(false);
    setError("");
    setBusy(false);
    setConfirmToken(null);
    joinLock.current.held = false;
  }, [open]);

  function stage(raw: string) {
    const token = inviteTokenFromInput(raw);
    if (!token) { setError("Kode tidak dikenali. Tempel kode atau tautan undangan."); return; }
    setError("");
    setConfirmName(inviteOwnerName(raw));
    setConfirmToken(token);
  }

  async function confirmJoin() {
    const token = confirmToken;
    if (!token || !claimJoinClick(joinLock.current)) return;
    setBusy(true);
    setError("");
    try {
      rememberInvite(token, localStorage, sessionStorage, { name: confirmName });
      const result = await acceptInvite(token);
      if (result === "skipped") {
        joinLock.current.held = false;
        setError(joinFailureMessage("seats_full"));
        setBusy(false);
        setConfirmToken(null);
        return;
      }
      toast("Sudah terhubung dengan pasangan. Catatan bisa dikelola bersama.");
      onOpenChange(false);
      go("#/pasangan");
    } catch (e) {
      joinLock.current.held = false;
      setError(joinFailureMessage(e instanceof ApiError ? e.code : ""));
      setBusy(false);
      setConfirmToken(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Gabung dengan kode" initialFocus={inputRef}>
      <Form className="stack" onSubmit={(event) => { event.preventDefault(); stage(code); }}>
        <p className="muted">Tempel kode dari pasangan, tautan undangannya, atau pindai QR. Hasilnya sama dengan membuka tautan.</p>
        <TextField className="field" value={code} onChange={setCode} isInvalid={!!error} autoFocus>
          <Label>Kode undangan</Label>
          <Input ref={inputRef} className="input" placeholder="Tempel kode atau tautan" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        </TextField>
        {error && <p role="alert" style={{ color: "var(--field-danger)" }}>{error}</p>}
        <Button type="submit" className="btn btn-blue block" isDisabled={busy}>Lanjut</Button>
        <Button type="button" className="btn btn-soft block" isDisabled={busy} onPress={() => setScanning((value) => !value)}>
          <QrCode size={18} />{scanning ? "Tutup kamera" : "Pindai QR"}
        </Button>
        {scanning && <QrScanner active={scanning && open && !confirmToken} onText={(value) => { setCode(value); stage(value); }} />}
      </Form>
      <Sheet open={!!confirmToken} onOpenChange={(next) => { if (!next && !busy) setConfirmToken(null); }} title={joinConfirmCopy(confirmName)}>
        <div className="stack" style={{ marginTop: 16 }}>
          <p>Catatan di HP ini ikut ke rumah itu.</p>
          <JoinDataNote />
          <button type="button" className="btn btn-blue block" disabled={busy} aria-busy={busy} onClick={() => void confirmJoin()}>{busy ? "Menggabungkan…" : "Gabung"}</button>
          <button type="button" className="btn btn-soft block" disabled={busy} onClick={() => setConfirmToken(null)}>Nanti</button>
        </div>
      </Sheet>
    </Sheet>
  );
}

function WhatsAppBanner({ invite }: { invite: string }) {
  const url = new URL(location.href);
  url.hash = inviteReturnHash(invite);
  const href = externalBrowserHref(url.toString(), navigator.userAgent);
  const android = isAndroid(navigator.userAgent);
  return (
    <aside className="wa-banner" role="region" aria-label="Buka di browser">
      <p>Undangan ini terbuka di WhatsApp, terpisah dari Momong di layar utama.</p>
      <a className="btn btn-blue lg block" href={href} {...(android ? {} : { target: "_blank", rel: "noopener noreferrer" })}>Buka di Safari/Chrome</a>
      <p>Di iPhone, buka aplikasi Momong, masuk, lalu tempel kode undangan.</p>
    </aside>
  );
}

/** #/masuk?token=… — magic link landing. */
export function MagicLanding({ token }: { token: string | null }) {
  const [state, setState] = useState<"working" | "error">("working");
  useEffect(() => {
    if (!token) { setState("error"); return; }
    (async () => {
      try {
        if (!verifying.has(token)) verifying.set(token, verifyMagicLink(token));
        await verifying.get(token);
        const pendingInvite = readInvite();
        if (pendingInvite) {
          go(`#/gabung?invite=${encodeURIComponent(pendingInvite)}`);
          return;
        } else toast("Sudah masuk. Selamat datang kembali!");
        go(authDestination("#/"));
      } catch {
        setState("error");
      }
    })();
  }, [token]);
  return (
    <>
      <TopBar title="Masuk" back="#/pasangan" />
      <div className="card solid empty" role="status">
        {state === "working"
          ? <><strong>Sebentar…</strong>Menyambungkan akun kamu.</>
          : <><strong>Tautan tidak berlaku</strong>Mungkin sudah dipakai atau lewat 15 menit. Minta tautan baru dari halaman Pasangan.</>}
      </div>
    </>
  );
}

/** #/gabung?invite=… — partner invite landing. Logged-out visits choose how to sign in. Google starts only from that button. */
export function JoinLanding({ invite }: { invite: string | null }) {
  const h = useHousehold();
  const inApp = isWhatsAppBrowser(navigator.userAgent);
  const valid = !!invite && isInviteToken(invite);
  const [returned, setReturned] = useState(() => {
    const nav = navigationType();
    const marker = sessionStorage.getItem("bb_google");
    if (shouldClearStaleGoogle(location.hash, marker, nav)) {
      sessionStorage.removeItem("bb_google");
      return false;
    }
    return nav === "back_forward" && takeGoogleReturn();
  });
  const [startFailed, setStartFailed] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const googleBusyRef = useRef(false);
  googleBusyRef.current = googleBusy;
  const [phase, setPhase] = useState<"ask" | "joining" | "declined" | "error">("ask");
  const [joinCode, setJoinCode] = useState("");
  const joinLock = useRef({ held: false });
  const houseName = (invite ? inviteOwnerName(location.hash) : "") || readInviteName();

  useEffect(() => {
    if (!valid || !invite || inApp) return;
    rememberInvite(invite, localStorage, sessionStorage, {
      name: inviteOwnerName(location.hash),
      accountId: h.me?.user.id ?? null,
    });
    if (!h.signedIn) {
      const back = inviteReturnHash(invite);
      if (isSafeInviteReturn(back)) sessionStorage.setItem("bb_auth_return", back);
      return;
    }
    reconcilePendingInvite(h.me?.user.id ?? null);
  }, [invite, valid, inApp, h.signedIn, h.me?.user.id]);

  useEffect(() => {
    if (!valid || !h.signedIn || inApp || !h.partner) return;
    clearInvite();
    go("#/pasangan");
  }, [valid, h.signedIn, inApp, h.partner]);

  useEffect(() => {
    const release = (marker: string | null) => {
      const away = marker === "away";
      abandonGoogleStart();
      setGoogleBusy(false);
      if (away) setReturned(true);
    };
    const onShow = (event: PageTransitionEvent) => {
      const marker = sessionStorage.getItem("bb_google");
      if (event.persisted && takeGoogleReturn()) setReturned(true);
      if (googleChoiceResume({ busy: googleBusyRef.current, marker, persisted: event.persisted, visible: false }) === "reset") release(marker);
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const marker = sessionStorage.getItem("bb_google");
      if (googleChoiceResume({ busy: googleBusyRef.current, marker, persisted: false, visible: true }) === "reset") release(marker);
    };
    addEventListener("pageshow", onShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      removeEventListener("pageshow", onShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  async function beginGoogle() {
    if (googleBusy) return;
    setGoogleBusy(true);
    setStartFailed(false);
    try {
      await startGoogle();
    } catch {
      setStartFailed(true);
      setGoogleBusy(false);
    }
  }

  function skipAccount() {
    setPrefs({ guest: true });
    sessionStorage.removeItem("bb_auth_return");
    sessionStorage.removeItem("bb_google");
    go("#/");
  }

  async function confirmJoin() {
    if (!invite || !claimJoinClick(joinLock.current)) return;
    setPhase("joining");
    const result = await consumePendingInvite(invite);
    if (result.ok === "failed") {
      joinLock.current.held = false;
      setJoinCode(result.code);
      setPhase("error");
      return;
    }
    if (result.ok === "joined") toast("Sudah terhubung dengan pasangan. Catatan bisa dikelola bersama.");
    go("#/pasangan");
  }

  if (!HAS_API) return <><TopBar title="Gabung" /><NoServer /></>;
  if (!valid) return <><TopBar title="Gabung" /><div className="card solid empty"><strong>Tautan tidak lengkap</strong>Minta pasangan kirim ulang undangan.</div></>;
  if (inApp) return <><TopBar title="Gabung" back="#/" /><WhatsAppBanner invite={invite!} /><Hero title="Kamu diundang mencatat bersama" body="Masuk dengan Google di Safari atau Chrome. Setelah masuk, konfirmasi sebelum bergabung." /></>;

  const phaseNow = googlePhase();
  const showGoogleError = inviteShowsGoogleError({ returnedWithoutSession: returned, startFailed });
  if (inviteEntry({ signedIn: h.signedIn, validInvite: valid }) === "choose") {
    if (phaseNow === "finishing") {
      return (
        <>
          <TopBar title="Gabung" />
          <div className="card solid empty" role="status" aria-busy="true">
            <strong>Menyambungkan akun…</strong>
            Setelah masuk, konfirmasi sebelum bergabung.
          </div>
        </>
      );
    }
    return (
      <>
        <TopBar title="Gabung" />
        <Hero title="Kamu diundang mencatat bersama" body="Pilih cara masuk. Setelah masuk, konfirmasi sebelum bergabung." />
        <div className="stack">
          {showGoogleError && <p role="alert" style={{ color: "var(--field-danger)" }}>Masuk Google belum selesai. Coba lagi dari browser ini.</p>}
          <button type="button" className="btn btn-blue lg block" disabled={googleBusy} aria-busy={googleBusy} onClick={() => void beginGoogle()}>{googleBusy ? "Membuka masuk Google…" : "Lanjut dengan Google"}</button>
          <button type="button" className="btn btn-soft block" disabled={googleBusy} onClick={() => { if (!googleBusy) location.hash = "#/masuk-akun"; }}>Masuk dengan email</button>
          <button type="button" className="btn btn-soft block" disabled={googleBusy} onClick={skipAccount}>Lanjut tanpa akun</button>
        </div>
      </>
    );
  }
  if (phase === "error") {
    return (
      <>
        <TopBar title="Gabung" />
        <Hero title="Gabung mencatat bersama" body="Catatan di HP ini akan digabung dengan catatan pasangan. Kalian berdua bisa menambah dan mengedit." />
        <div className="stack">
          <p role="alert" style={{ color: "var(--field-danger)" }}>{joinFailureMessage(joinCode)}</p>
          <button className="btn btn-blue lg block" onClick={() => setPhase("ask")}>Coba lagi</button>
        </div>
      </>
    );
  }
  if (h.signedIn && !h.partner) {
    return (
      <>
        <TopBar title="Gabung" />
        <Hero title="Kamu diundang mencatat bersama" body="Cek dulu rumah yang kamu ikuti. Gabung setelah kamu yakin." />
        <Sheet open={phase === "ask" || phase === "joining"} onOpenChange={(open) => { if (!open && phase !== "joining") setPhase("declined"); }} title={joinConfirmCopy(houseName)}>
          <div className="stack" style={{ marginTop: 16 }}>
            <p>Catatan di HP ini ikut ke rumah itu. Kamu tetap di akun ini kalau memilih nanti.</p>
            <JoinDataNote />
            <button type="button" className="btn btn-blue lg block" disabled={phase === "joining"} aria-busy={phase === "joining"} onClick={() => void confirmJoin()}>{phase === "joining" ? "Menggabungkan…" : "Gabung"}</button>
            <button type="button" className="btn btn-soft block" disabled={phase === "joining"} onClick={() => setPhase("declined")}>Nanti</button>
          </div>
        </Sheet>
        {phase === "declined" && <button type="button" className="btn btn-blue lg block" onClick={() => setPhase("ask")}>Gabung</button>}
      </>
    );
  }
  return (
    <>
      <TopBar title="Gabung" />
      <div className="card solid empty" role="status">
        <strong>Sebentar…</strong>
      </div>
    </>
  );
}
