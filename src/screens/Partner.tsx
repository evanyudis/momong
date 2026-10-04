import { CloudOff, LogOut, Mail, MessageCircle, RefreshCw, UserRound, UserRoundPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { agoLabel } from "../dates";
import { initial, useHousehold } from "../household";
import { go } from "../route";
import { getPrefs } from "../store";
import {
  HAS_API, ApiError, createInvite, joinHousehold, removeMember, requestMagicLink, signOut, syncNow, useAccount, verifyMagicLink,
} from "../sync";
import { toast, TopBar } from "../ui";

const PENDING_INVITE = "bb_pending_invite";
// A magic-link token is single-use; dedupe so a re-run effect can't burn it twice.
const verifying = new Map<string, Promise<void>>();

export function SyncDot() {
  const acc = useAccount();
  const map = {
    local: ["var(--ink-faint)", "Hanya di HP ini"],
    offline: ["var(--warning)", "Offline · tersimpan di HP"],
    syncing: ["var(--accent-primary)", "Menyinkron…"],
    synced: ["var(--success)", `Tersinkron · ${acc.lastSyncAt ? agoLabel(acc.lastSyncAt) : ""}`],
    error: ["var(--warning)", "Belum tersinkron · coba lagi"],
  } as const;
  const status = acc.status === "local" && acc.token && acc.lastSyncAt ? "synced" : acc.status;
  const [color, text] = map[status];
  return (
    <span className="row" style={{ gap: 6, color: status === "synced" ? "var(--success-ink)" : "var(--ink-muted)", fontWeight: 500 }}>
      <span className="dot" style={{ background: color }} />{text}
    </span>
  );
}

export function Partner() {
  const h = useHousehold();
  return (
    <>
      <TopBar title="Pasangan" />
      {!HAS_API ? <NoServer /> : h.signedIn ? <Household /> : <SignIn />}
    </>
  );
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

function SignIn({ invite }: { invite?: boolean }) {
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
        title={invite ? "Kamu diundang mencatat bersama" : "Ajak pasangan mencatat bersama"}
        body={invite
          ? "Masuk dengan email dulu. Setelah itu kamu langsung bergabung dan catatan kalian tersinkron."
          : "Berdua lebih ringan. Masuk dengan email untuk sinkron dan undang pasangan. Gratis untuk 2 orang."}
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
          {state === "error" && <p style={{ color: "var(--danger)", fontSize: 15 }}>Tautan belum terkirim. Cek koneksi lalu coba lagi.</p>}
          <button className="btn btn-blue lg block" disabled={state === "sending"}>{state === "sending" ? "Mengirim…" : "Kirim tautan masuk"}</button>
          <p className="faint" style={{ fontSize: 13, textAlign: "center" }}>Tanpa kata sandi. Catatan tetap tersimpan di HP walau offline.</p>
        </form>
      )}
    </>
  );
}

function Household() {
  const h = useHousehold();
  const [invite, setInvite] = useState<{ url: string } | null>(null);
  const full = h.seatsUsed >= h.seats;

  useEffect(() => {
    if (full || !h.isOwner || invite) return;
    createInvite().then(setInvite).catch(() => {});
  }, [full, h.isOwner, invite]);

  const name = getPrefs().name || "Bunda";
  const message = invite
    ? `Yuk catat kehamilan & si kecil bareng di BumpBuddy. Gabung lewat tautan ini (berlaku 7 hari): ${invite.url}`
    : "";

  async function share() {
    if (!invite) return;
    try {
      if (navigator.share) await navigator.share({ title: "BumpBuddy", text: message });
      else { await navigator.clipboard.writeText(invite.url); toast("Tautan disalin"); }
    } catch { /* user cancelled */ }
  }

  async function revoke(id: string, self: boolean) {
    if (!confirm(self ? "Keluar dari keluarga ini? Catatan di HP ini tetap ada." : `Hapus ${h.partnerName} dari keluarga? Catatan bersama tetap ada.`)) return;
    try { await removeMember(id); setInvite(null); toast(self ? "Kamu keluar dari keluarga" : "Pasangan dihapus"); }
    catch { toast("Gagal. Coba lagi."); }
  }

  return (
    <>
      {h.partner
        ? <Hero title="Kalian mencatat berdua" body={`Catatan kamu dan ${h.partnerName} tersinkron di kedua HP. Kalian berdua bisa menambah dan mengedit.`} />
        : <Hero title="Ajak pasangan mencatat bersama" body="Berdua lebih ringan. Catat kontraksi, gerakan, menyusu, dan popok dari HP masing-masing." />}
      <div className="stack">
        <section className="card solid">
          <div className="spread">
            <span className="label" style={{ fontWeight: 600 }}>Kursi keluarga</span>
            <span className={`muted num ${full ? "" : ""}`} style={{ fontSize: 15 }}>{h.seatsUsed} dari {h.seats} terisi</span>
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
                  <span className="avatar coral" style={{ width: 48, height: 48, boxShadow: "none" }}>{initial(h.partnerName)}</span>
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
            <button className="icon-btn" aria-label="Sinkron sekarang" onClick={() => void syncNow()}><RefreshCw size={18} /></button>
          </div>
        </section>

        {!full && h.isOwner && (
          <div className="stack" style={{ marginTop: 12 }}>
            <a
              className="btn btn-blue lg block"
              href={invite ? `https://wa.me/?text=${encodeURIComponent(message)}` : undefined}
              aria-disabled={!invite}
              target="_blank" rel="noreferrer"
            >
              <MessageCircle size={22} /> Undang lewat WhatsApp
            </a>
            <button className="btn btn-ghost lg block" onClick={share} disabled={!invite}>Bagikan tautan</button>
            <p className="faint" style={{ fontSize: 14, textAlign: "center" }}>Tautan undangan berlaku 7 hari</p>
          </div>
        )}
        {full && (
          <p className="muted" style={{ textAlign: "center", fontSize: 15 }}>Kedua kursi sudah terisi.</p>
        )}

        <button className="link-btn muted" style={{ justifySelf: "center", fontWeight: 500 }} onClick={() => { void signOut(); toast("Keluar dari akun. Catatan tetap di HP ini."); }}>
          <LogOut size={16} style={{ marginRight: 6 }} />Keluar akun ({h.me?.user.email})
        </button>
      </div>
    </>
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
        const pendingInvite = localStorage.getItem(PENDING_INVITE);
        if (pendingInvite) {
          localStorage.removeItem(PENDING_INVITE);
          await joinHousehold(pendingInvite).then(() => toast("Kamu bergabung dengan pasangan")).catch(() => toast("Undangan sudah tidak berlaku"));
        } else toast("Berhasil masuk");
        go("#/pasangan");
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

/** #/gabung?invite=… — partner invite landing. */
export function JoinLanding({ invite }: { invite: string | null }) {
  const h = useHousehold();
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (invite && !h.signedIn) localStorage.setItem(PENDING_INVITE, invite); }, [invite, h.signedIn]);

  if (!HAS_API) return <><TopBar title="Gabung" /><NoServer /></>;
  if (!invite) return <><TopBar title="Gabung" /><div className="card solid empty"><strong>Tautan tidak lengkap</strong>Minta pasangan kirim ulang undangan.</div></>;
  if (!h.signedIn) return <><TopBar title="Gabung" /><SignIn invite /></>;

  async function join() {
    setBusy(true);
    try {
      await joinHousehold(invite!);
      toast("Kamu bergabung dengan pasangan");
      go("#/pasangan");
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "";
      toast(code === "seats_full" ? "Kursi keluarga sudah penuh" : "Undangan sudah tidak berlaku");
      setBusy(false);
    }
  }
  return (
    <>
      <TopBar title="Gabung" />
      <Hero title="Gabung mencatat bersama" body="Catatan di HP ini akan digabung dengan catatan pasangan. Kalian berdua bisa menambah dan mengedit." />
      <button className="btn btn-blue lg block" onClick={join} disabled={busy}>{busy ? "Menggabungkan…" : "Gabung sekarang"}</button>
    </>
  );
}
