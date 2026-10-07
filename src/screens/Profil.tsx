import { setTelemetryConsent, telemetryConfigured, telemetryConsent } from "../telemetry";
import { PLUS_ENABLED } from "../release";
import { RestoreSheet } from "./Restore";
import { InstallSheet } from "./Install";
import { ChevronRight, Download, Sun, Moon, Monitor } from "lucide-react";
import { useState } from "react";
import type { PlusVariant } from "../content";
import { todayISO } from "../dates";
import { useHousehold } from "../household";
import { addBaby, babyProfiles, activeBabyId, isPlus, exportJSON, getPrefs, type Prefs, saveSettings, setPrefs, settings, useDB } from "../store";
import { resetGuestData, signOut } from "../sync";
import { SyncDot } from "./Partner";
import { DateInput, Header, PlusBadge, PlusSheet, Sheet, toast } from "../ui";

export function applyTheme(theme: Prefs["theme"]) {
  const dark = theme === "dark" || (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  // Theme flips must not run every color transition on the page.
  const style = document.createElement("style");
  // Colors snap; only transform/opacity motion (e.g. the segmented thumb) keeps playing.
  style.textContent = "*,*::before,*::after{transition-property:transform,translate,scale,opacity!important}";
  document.head.appendChild(style);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#141414" : "#fafafa");
  requestAnimationFrame(() => requestAnimationFrame(() => style.remove()));
}

/** Profil tab: mode, theme, export, and the link to Sinkron & pasangan. Settings live here; there is no separate settings page. */
export function Profil() {
  useDB();
  const [analytics, setAnalytics] = useState(telemetryConsent);
  const s = settings();
  const prefs = getPrefs();
  const h = useHousehold();
  const born = s.birthMode === "postpartum";
  const [editingProfile, setEditingProfile] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [bornOpen, setBornOpen] = useState(false);
  const [backOpen, setBackOpen] = useState(false);
  const [addingBaby, setAddingBaby] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [plus, setPlus] = useState<PlusVariant | null>(null);

  function download() {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `momong-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <Header title="Profil" aside={h.signedIn ? undefined : <a className="btn sm btn-signin" href="#/masuk-akun">Masuk</a>} />
      <div className="stack">
        <section className="profile-identity"><span className="avatar blue" aria-hidden="true">{(prefs.name || h.me?.user.email || "M").slice(0, 1).toUpperCase()}</span><div><h2>{prefs.name || "Teman Momong"}</h2><p className="muted">{h.me?.user.email || "Catatan lokal · tanpa akun"}</p></div></section>
        <section className="card plus-card stack">
          <div className="spread"><div className="card-title">{isPlus() ? h.me?.entitlement.plan === "plus_lifetime" ? "Plus · Selamanya" : h.me?.entitlement.plan === "trial" ? "Plus · Trial" : "Plus · Bulanan" : "Momong Plus"}</div><PlusBadge size="medium" /></div>
          <p className="card-sub">Perkiraan, grafik, pengingat, riwayat lengkap, PDF tanpa batas, wishlist berbagi, dan multi bayi.  {isPlus() ? "Akses Plus kamu aktif." : "Fitur Plus segera hadir."}</p>
          {!PLUS_ENABLED && !isPlus() ? <button className="btn btn-coral block" disabled>Segera hadir</button> : isPlus() ? <a className="btn btn-coral block" href="#/plus">Lihat status Plus</a>
            : <button className="btn btn-coral block" aria-haspopup="dialog" onClick={() => setPlus("overview")}>Coba Plus</button>}
        </section>
        {(PLUS_ENABLED || isPlus()) && <section className="card solid stack">
          <label className="field"><span>Profil si kecil</span>
            <select className="input" value={activeBabyId()} onChange={(e) => setPrefs({ activeBabyId: e.target.value })}>
              {babyProfiles().filter((b) => isPlus() || b.id === "default").map((b) => <option key={b.id} value={b.id}>{b.babyName || "Si kecil"}</option>)}
            </select>
          </label>
          <button className="btn btn-soft block" disabled={!PLUS_ENABLED && !isPlus()} onClick={() => isPlus() ? setAddingBaby(true) : setPlus("insights")}>{PLUS_ENABLED || isPlus() ? "Tambah profil bayi · Plus" : "Segera hadir"}</button>
          {!isPlus() && babyProfiles().length > 1 && <p className="muted">Profil tambahan tetap tersimpan dan dapat dibuka saat Plus aktif.</p>}
        </section>}
        <button className="card solid" aria-haspopup="dialog" onClick={() => setEditingProfile(true)}>
          <div className="spread"><div><div className="card-title">Detail profil</div><p className="card-sub">{prefs.name || "Nama panggilan"} · {s.babyName || "Si kecil"}</p></div><ChevronRight size={20} /></div>
        </button>

        {(PLUS_ENABLED || isPlus()) && <a className="btn btn-soft block" href="#/pengingat">Pengingat · Plus</a>}


        <section className="card solid">
          <div className="spread">
            <div>
              <div className="card-title" style={{ fontSize: 16 }}>Sudah lahir?</div>
              <div className="card-sub">Catat minum susu, menyusu langsung, pumping, dan ganti popok. Bisa kembali ke mode hamil kapan saja.</div>
            </div>
            <button
              className="switch" role="switch" aria-checked={born} aria-label="Sudah lahir"
              onClick={() => (born ? setBackOpen(true) : setBornOpen(true))}
            />
          </div>

        </section>


        <a className="card solid" href={h.signedIn ? "#/pasangan" : "#/masuk-akun?mode=signup"}>
          <div className="spread">
            <div>
              <div className="card-title" style={{ fontSize: 16 }}>Sinkron & pasangan</div>
              <div style={{ fontSize: 14, marginTop: 2 }}>{h.signedIn ? <SyncDot /> : <span className="muted">Belum terhubung · catatan lokal</span>}</div>
            </div>
            <ChevronRight size={20} className="faint" />
          </div>
          {!h.signedIn && <p className="card-sub">Daftar untuk menyimpan catatan online dan sinkron dengan pasangan. Gratis.</p>}
          {h.signedIn && !h.acc.syncEnabled && <p className="card-sub">Aktifkan sinkronisasi agar catatan tersimpan online.</p>}
        </a>

        <button className="card solid" onClick={download}>
          <div className="spread">
            <div>
              <div className="card-title" style={{ fontSize: 16 }}>Ekspor data (JSON)</div>
              <div className="card-sub">Salinan semua catatan di HP ini</div>
            </div>
            <Download size={20} className="faint" />
          </div>
        </button>

        <button className="card solid" aria-haspopup="dialog" onClick={() => setInstallOpen(true)}><div className="spread"><span className="card-title">Tambahkan ke layar utama</span><ChevronRight size={20} /></div></button>
        {h.signedIn && <section className="card solid stack">
          <div className="card-title">Akun</div>
          <p className="muted">{h.me?.user.email}</p>
          <button className="btn btn-soft block" onClick={() => {
            void signOut(); toast("Keluar dari akun. Catatan tetap di HP ini.");
          }}>Keluar akun</button>
        </section>}
        <section className="card solid spread theme-card">
          <div className="card-title" style={{ fontSize: 16 }}>Tema</div>
          <div className="segmented theme-options" role="group" aria-label="Tema" style={{ "--n": 3, "--i": ["light", "dark", "system"].indexOf(prefs.theme ?? "system") } as React.CSSProperties}>
            {([["light", "Terang", Sun], ["dark", "Gelap", Moon], ["system", "Sistem", Monitor]] as const).map(([v, l, Icon]) => (
              <button key={v} aria-label={l} title={l} aria-pressed={(prefs.theme ?? "system") === v} onClick={() => { setPrefs({ theme: v }); applyTheme(v); }}><Icon size={20} aria-hidden="true" /></button>
            ))}
          </div>
        </section>

        {telemetryConfigured() && <section className="card solid">
          <div className="spread">
            <div><div className="card-title">Bantu tingkatkan Momong</div><p className="card-sub" id="telemetry-description">Izinkan pengiriman statistik halaman dan error teknis ke PostHog. Isi catatan, nama, email, dan tanggal tidak dikirim. Bisa dimatikan kapan saja.</p></div>
            <button type="button" className="switch" role="switch" aria-checked={analytics} aria-label="Bantu tingkatkan Momong" aria-describedby="telemetry-description" onClick={() => { const next = !analytics; setTelemetryConsent(next); setAnalytics(telemetryConsent()); }} />
          </div>
        </section>}

        {!h.acc.token && <section className="card solid stack">
          <div className="card-title">Data di perangkat</div>
          <p className="card-sub">Cadangan dan catatan yang tersimpan di HP ini.</p>
          <button type="button" className="btn btn-soft block" onClick={() => setRestoreOpen(true)}>Pulihkan cadangan</button>
          <button className="btn btn-danger-soft block" aria-haspopup="dialog" onClick={() => setResetOpen(true)}>Hapus semua data di perangkat</button>
        </section>}
        <p className="faint" style={{ fontSize: 13, textAlign: "center", marginTop: 8 }}>Momong · Catatan, bukan saran medis.</p>
      </div>

      <Sheet open={editingProfile} onOpenChange={setEditingProfile} title="Detail profil">        <div className="stack">
          <label className="field">
            <span>Nama panggilan</span>
            <input className="input" maxLength={120} value={prefs.name ?? ""} placeholder="Bunda" onChange={(e) => setPrefs({ name: e.target.value })} />
          </label>
          <label className="field">
            <span>Nama si kecil</span>
            <input className="input" maxLength={120} value={s.babyName ?? ""} placeholder="Si kecil" onChange={(e) => saveSettings({ babyName: e.target.value })} />
          </label>
          {!born && <label className="field">
            <span>HPL (hari perkiraan lahir)</span>
            <DateInput value={s.hpl ?? ""} onChange={(e) => e.target.value && saveSettings({ hpl: e.target.value })} />
          </label>}
        </div>          {born && (
            <div className="stack" style={{ marginTop: 16 }}>
              <label className="field">
                <span>Tanggal lahir</span>
                <DateInput max={todayISO()} value={s.babyBirth ?? ""} onChange={(e) => e.target.value && e.target.validity.valid && saveSettings({ babyBirth: e.target.value })} />
              </label>
            </div>
          )}<button className="btn btn-ink block" style={{ marginTop: 16 }} onClick={() => setEditingProfile(false)}>Selesai</button></Sheet>
      <RestoreSheet open={restoreOpen} onOpenChange={setRestoreOpen} />
      <InstallSheet open={installOpen} onOpenChange={setInstallOpen} />
      <AddBabySheet open={addingBaby} onOpenChange={setAddingBaby} />
      <BornSheet open={bornOpen} onOpenChange={setBornOpen} />
      <PregnantSheet open={backOpen} onOpenChange={setBackOpen} />
      <PlusSheet variant={plus} onClose={() => setPlus(null)} />
      <Sheet open={resetOpen} onOpenChange={setResetOpen} title="Hapus semua data di perangkat?">
        <p className="muted">Semua catatan, profil bayi, setup, pengingat, tema, dan antrean sinkron di perangkat ini akan dihapus permanen. Data yang sudah tersimpan di server tetap ada.</p>
        <div className="stack reset-actions">
          <button className="btn btn-ink block" onClick={() => setResetOpen(false)}>Batal</button>
          <button className="btn btn-soft block" onClick={download}>Ekspor JSON</button>
        </div>
        <div className="reset-danger">
          <button className="btn btn-danger block" onClick={() => {
            if (resetGuestData()) location.replace(`${location.pathname}#/`);
          }}>Hapus semua data</button>
        </div>
      </Sheet>
    </>
  );
}

/** Switching mode preserves every log. */
function PregnantSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [error, setError] = useState("");
  const [hpl, setHpl] = useState(settings().hpl ?? "");
  function switchMode() {
    try {
      saveSettings({ birthMode: "pregnant", hpl: settings().hpl || hpl });
      onOpenChange(false);
      toast("Mode kehamilan aktif. Catatan newborn tetap tersimpan.");
      location.hash = "#/";
    } catch { setError("Mode belum berubah. Coba lagi."); }
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Kembali ke mode hamil?">
      {error && <p role="alert">{error}</p>}
      <p className="muted" style={{ marginBottom: 16 }}>Catatan newborn tetap tersimpan. Kamu bisa pindah lagi ke mode newborn kapan saja.</p>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); switchMode(); }}>
        {!settings().hpl && <label className="field"><span>HPL (hari perkiraan lahir)</span><DateInput required value={hpl} onChange={(e) => setHpl(e.target.value)} /></label>}
        <button className="btn btn-coral lg block" disabled={!(settings().hpl || hpl)}>
          Ya, kembali
        </button>
        <button type="button" className="btn btn-soft block" onClick={() => onOpenChange(false)}>Nanti saja</button>
      </form>
    </Sheet>
  );
}

function BornSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [date, setDate] = useState(todayISO());
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Selamat datang, si kecil">
      {error && <p role="alert">{error}</p>}
      <p className="muted" style={{ marginBottom: 16 }}>Catatan kehamilan tetap tersimpan. Kamu bisa kembali ke mode hamil kapan saja.</p>
      <div className="stack">
        <label className="field"><span>Nama si kecil (opsional)</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Si kecil" /></label>
        <label className="field"><span>Tanggal lahir</span><DateInput max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <button
          className="btn btn-coral lg block" disabled={!date}
          onClick={() => {
            try {
              saveSettings({ birthMode: "postpartum", babyBirth: date, babyName: name.trim() || undefined });
              onOpenChange(false); toast("Mode newborn aktif. Catatan kehamilan tetap tersimpan."); location.hash = "#/";
            } catch { setError("Mode belum berubah. Coba lagi."); }
          }}
        >
          Pindah ke mode newborn
        </button>
      </div>
    </Sheet>
  );
}

function AddBabySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"pregnant" | "postpartum">("postpartum");
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState("");
  return <Sheet open={open} onOpenChange={onOpenChange} title="Tambah profil si kecil">
    <form className="stack" onSubmit={(e) => {
      e.preventDefault();
      const form = new FormData(e.currentTarget);
      const profileName = String(form.get("babyName") ?? "").trim();
      const profileDate = String(form.get("profileDate") ?? "");
      if (addBaby({ babyName: profileName, birthMode: mode, ...(mode === "pregnant" ? { hpl: profileDate } : { babyBirth: profileDate }) })) {
        onOpenChange(false); setName(""); setError(""); location.hash = "#/";
      } else setError("Isi nama dan tanggal yang valid. Tanggal lahir tidak boleh setelah hari ini; profil tambahan membutuhkan Plus.");
    }}>
      {error && <p role="alert">{error}</p>}
      <label className="field"><span>Nama si kecil</span><input className="input" name="babyName" required maxLength={120} pattern={String.raw`.*\S.*`} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field"><span>Mode</span><select className="input" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="postpartum">Newborn</option><option value="pregnant">Kehamilan</option></select></label>
      <label className="field"><span>{mode === "pregnant" ? "HPL" : "Tanggal lahir"}</span><DateInput name="profileDate" required max={mode === "postpartum" ? todayISO() : undefined} value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <button className="btn btn-ink block">Simpan profil</button>
    </form>
  </Sheet>;
}
