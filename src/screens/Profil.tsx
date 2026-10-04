import { Download } from "lucide-react";
import { useState } from "react";
import { todayISO } from "../dates";
import { exportJSON, getPrefs, type Prefs, saveSettings, setPrefs, settings, useDB } from "../store";
import { PartnerSection } from "./Partner";
import { DateInput, Header, Sheet } from "../ui";

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

/** Profil tab: account, partner, mode, sync, export. Settings live here; there is no separate settings page. */
export function Profil() {
  useDB();
  const s = settings();
  const prefs = getPrefs();
  const born = s.birthMode === "postpartum";
  const [bornOpen, setBornOpen] = useState(false);

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
      <Header title="Profil" />
      <div className="stack">
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

        <section className="card solid">
          <div className="spread">
            <div>
              <div className="card-title" style={{ fontSize: 16 }}>Sudah lahir?</div>
              <div className="card-sub">Mode newborn: botol, ASI, pompa, popok. Bisa balik kapan saja.</div>
            </div>
            <button
              className="switch" role="switch" aria-checked={born} aria-label="Sudah lahir"
              onClick={() => (born ? saveSettings({ birthMode: "pregnant" }) : setBornOpen(true))}
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

        <PartnerSection />

        <button className="card solid" onClick={download}>
          <div className="spread">
            <div>
              <div className="card-title" style={{ fontSize: 16 }}>Ekspor data (JSON)</div>
              <div className="card-sub">Salinan semua catatan di HP ini</div>
            </div>
            <Download size={20} className="faint" />
          </div>
        </button>

        <p className="faint" style={{ fontSize: 13, textAlign: "center", marginTop: 8 }}>BumpBuddy · Catatan, bukan saran medis.</p>
      </div>

      <BornSheet open={bornOpen} onOpenChange={setBornOpen} />
    </>
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
