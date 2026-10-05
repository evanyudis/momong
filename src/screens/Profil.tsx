import { ChevronRight, Download } from "lucide-react";
import { useEffect, useState } from "react";
import type { PlusVariant } from "../content";
import { todayISO } from "../dates";
import { useHousehold } from "../household";
import { addBaby, babyProfiles, activeBabyId, isPlus, exportJSON, getPrefs, type Prefs, saveSettings, setPrefs, settings, useDB } from "../store";
import { signOut } from "../sync";
import { SyncDot } from "./Partner";
import { DateInput, Header, PlusSheet, Sheet, toast } from "../ui";

export function applyTheme(theme: Prefs["theme"]) {
  const dark = theme === "dark" || (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  // Theme flips must not run every color transition on the page.
  const style = document.createElement("style");
  // Colors snap; only transform/opacity motion (e.g. the segmented thumb) keeps playing.
  style.textContent = "*,*::before,*::after{transition-property:transform,translate,scale,opacity!important}";
  document.head.appendChild(style);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#1b1917" : "#f7f2eb");
  requestAnimationFrame(() => requestAnimationFrame(() => style.remove()));
}

/** Profil tab: mode, theme, export, and the link to Sinkron & pasangan. Settings live here; there is no separate settings page. */
export function Profil() {
  useDB();
  const s = settings();
  const prefs = getPrefs();
  const h = useHousehold();
  const born = s.birthMode === "postpartum";
  const [bornOpen, setBornOpen] = useState(false);
  const [backOpen, setBackOpen] = useState(false);
  const [addingBaby, setAddingBaby] = useState(false);
  const [plus, setPlus] = useState<PlusVariant | null>(null);

  function download() {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bumpbuddy-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <Header title="Profil" aside={h.signedIn ? undefined : <a className="btn sm btn-signin" href="#/masuk-akun">Masuk</a>} />
      <div className="stack">
        <section className="card solid stack">
          <label className="field"><span>Profil si kecil</span>
            <select className="input" value={activeBabyId()} onChange={(e) => setPrefs({ activeBabyId: e.target.value })}>
              {babyProfiles().filter((b) => isPlus() || b.id === "default").map((b) => <option key={b.id} value={b.id}>{b.babyName || "Si kecil"}</option>)}
            </select>
          </label>
          <button className="btn btn-soft block" onClick={() => isPlus() ? setAddingBaby(true) : setPlus("insights")}>Tambah profil bayi · Plus</button>
          {!isPlus() && babyProfiles().length > 1 && <p className="muted">Profil tambahan tetap tersimpan dan dapat dibuka saat Plus aktif.</p>}
        </section>
        <section className="card solid stack">
          <label className="field">
            <span>Nama panggilan</span>
            <input className="input" value={prefs.name ?? ""} placeholder="Bunda" onChange={(e) => setPrefs({ name: e.target.value })} />
          </label>
          <label className="field">
            <span>HPL (hari perkiraan lahir)</span>
            <DateInput value={s.hpl ?? ""} onChange={(e) => e.target.value && saveSettings({ hpl: e.target.value })} />
          </label>
        </section>

        <a className="btn btn-soft block" href="#/pengingat">Pengingat · Plus</a>
        <section className="card plus-card stack">
          <div className="card-title">{h.me?.entitlement.plan === "plus_lifetime" ? "Plus · Selamanya" : "Plus · Selamanya (sandbox)"}</div>
          <p className="card-sub">Perkiraan, grafik, pengingat, riwayat lengkap, PDF tanpa batas, wishlist berbagi, dan multi bayi. Pembayaran masih sandbox.</p>
          <a className="btn btn-coral block" href="#/plus">{h.me?.entitlement.plan === "plus_lifetime" ? "Lihat status Plus" : "Coba Plus"}</a>
        </section>

        <section className="card solid">
          <div className="spread">
            <div>
              <div className="card-title" style={{ fontSize: 16 }}>Sudah lahir?</div>
              <div className="card-sub">Mode newborn: botol, ASI, pompa, popok. Bisa balik kapan saja.</div>
            </div>
            <button
              className="switch" role="switch" aria-checked={born} aria-label="Sudah lahir"
              onClick={() => (born ? setBackOpen(true) : setBornOpen(true))}
            />
          </div>
          {born && (
            <div className="stack" style={{ marginTop: 16 }}>
              <label className="field">
                <span>Nama si kecil</span>
                <input className="input" value={s.babyName ?? ""} placeholder="Si kecil" onChange={(e) => saveSettings({ babyName: e.target.value })} />
              </label>
              <label className="field">
                <span>Tanggal lahir</span>
                <DateInput max={todayISO()} value={s.babyBirth ?? ""} onChange={(e) => e.target.value && saveSettings({ babyBirth: e.target.value })} />
              </label>
            </div>
          )}
        </section>

        <section className="card solid">
          <div className="card-title" style={{ fontSize: 16, marginBottom: 12 }}>Tema</div>
          <div className="segmented" style={{ "--n": 3, "--i": ["light", "dark", "system"].indexOf(prefs.theme ?? "system") } as React.CSSProperties}>
            {([["light", "Terang"], ["dark", "Gelap"], ["system", "Sistem"]] as const).map(([v, l]) => (
              <button key={v} aria-pressed={(prefs.theme ?? "system") === v} onClick={() => { setPrefs({ theme: v }); applyTheme(v); }}>{l}</button>
            ))}
          </div>
        </section>

        <a className="card solid" href="#/pasangan">
          <div className="spread">
            <div>
              <div className="card-title" style={{ fontSize: 16 }}>Sinkron & pasangan</div>
              <div style={{ fontSize: 14, marginTop: 2 }}>{h.signedIn ? <SyncDot /> : <span className="muted">Gratis · opsional</span>}</div>
            </div>
            <ChevronRight size={20} className="faint" />
          </div>
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

        {h.signedIn && <section className="card solid stack">
          <div className="card-title">Akun</div>
          <p className="muted">{h.me?.user.email}</p>
          <button className="btn btn-soft block" onClick={() => {
            void signOut(); toast("Keluar dari akun. Catatan tetap di HP ini.");
          }}>Keluar akun</button>
        </section>}
        <p className="faint" style={{ fontSize: 13, textAlign: "center", marginTop: 8 }}>BumpBuddy · Catatan, bukan saran medis.</p>
      </div>

      <AddBabySheet open={addingBaby} onOpenChange={setAddingBaby} />
      <BornSheet open={bornOpen} onOpenChange={setBornOpen} />
      <PregnantSheet open={backOpen} onOpenChange={setBackOpen} />
      <PlusSheet variant={plus} onClose={() => setPlus(null)} />
    </>
  );
}

/** Newborn → hamil: confirm, short loading, then flip birthMode only. Every log stays. */
function PregnantSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => {
      saveSettings({ birthMode: "pregnant" }); // mode flag only; no collection is touched
      onOpenChange(false); // busy stays on through the exit; Profil unmounts on the hash change
      location.hash = "#/";
    }, 700);
    return () => clearTimeout(t);
  }, [busy, onOpenChange]);
  return (
    <Sheet open={open} onOpenChange={(o) => !busy && onOpenChange(o)} title="Kembali ke mode hamil?">
      <p className="muted" style={{ marginBottom: 16 }}>Catatan newborn tetap tersimpan. Kamu bisa pindah lagi ke mode newborn kapan saja.</p>
      <div className="stack">
        <button className="btn btn-coral lg block" disabled={busy} aria-busy={busy} onClick={() => setBusy(true)}>
          {busy ? "Memindahkan…" : "Ya, kembali"}
        </button>
        <button className="btn btn-soft block" disabled={busy} onClick={() => onOpenChange(false)}>Nanti saja</button>
      </div>
    </Sheet>
  );
}

function BornSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [date, setDate] = useState(todayISO());
  const [name, setName] = useState("");
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Selamat datang, si kecil">
      <p className="muted" style={{ marginBottom: 16 }}>Catatan kehamilan tetap tersimpan. Kamu bisa kembali ke mode hamil kapan saja.</p>
      <div className="stack">
        <label className="field"><span>Nama si kecil (opsional)</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Si kecil" /></label>
        <label className="field"><span>Tanggal lahir</span><DateInput max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <button
          className="btn btn-coral lg block" disabled={!date}
          onClick={() => { saveSettings({ birthMode: "postpartum", babyBirth: date, babyName: name.trim() || undefined }); onOpenChange(false); location.hash = "#/"; }}
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
  return <Sheet open={open} onOpenChange={onOpenChange} title="Tambah profil si kecil">
    <form className="stack" onSubmit={(e) => {
      e.preventDefault();
      if (addBaby({ babyName: name.trim(), birthMode: mode, ...(mode === "pregnant" ? { hpl: date } : { babyBirth: date }) })) {
        onOpenChange(false); setName(""); location.hash = "#/";
      }
    }}>
      <label className="field"><span>Nama si kecil</span><input className="input" required maxLength={120} pattern={String.raw`.*\S.*`} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field"><span>Mode</span><select className="input" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="postpartum">Newborn</option><option value="pregnant">Kehamilan</option></select></label>
      <label className="field"><span>{mode === "pregnant" ? "HPL" : "Tanggal lahir"}</span><DateInput required max={mode === "postpartum" ? todayISO() : undefined} value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <button className="btn btn-ink block">Simpan profil</button>
    </form>
  </Sheet>;
}
