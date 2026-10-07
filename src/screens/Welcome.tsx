import { Baby, Check, ChevronLeft, Heart } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { animate } from "../motion";
import { todayISO } from "../dates";
import { motherNameFromAccount, saveOnboarding } from "../onboarding";
import type { Settings } from "../store";
import { DateInput, toast } from "../ui";

export function Welcome({ user }: { user?: { name: string; email: string } }) {
  const [mode, setMode] = useState<Settings["birthMode"]>(undefined);
  const [details, setDetails] = useState(false);
  const [name, setName] = useState(user ? motherNameFromAccount(user) : "");
  const [hpl, setHpl] = useState("");
  const [birth, setBirth] = useState("");
  const [babyName, setBabyName] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const previousStep = useRef(details);
  const submitted = useRef(false);
  const [error, setError] = useState("");
  useLayoutEffect(() => {
    heading.current?.focus({ preventScroll: true });
    if (previousStep.current === details) return;
    previousStep.current = details;
    return animate(body.current, [{ opacity: 0, transform: `translateX(${details ? 12 : -12}px)` }, { opacity: 1, transform: "none" }], 220);
  }, [details]);

  function start(e: React.FormEvent) {
    e.preventDefault();
    if (submitted.current) return;
    submitted.current = true;
    try {
      if (saveOnboarding({ mode, name, hpl, babyBirth: birth, babyName })) {
        toast("Profil siap. Selamat datang di Momong!", true);
        location.hash = "#/";
      } else submitted.current = false;
    } catch { submitted.current = false; setError("Profil belum tersimpan. Coba lagi."); }
  }

  return (
    <div className="onboarding stack">
      <header className="header signin-head">
        {details && <button type="button" className="icon-btn" aria-label="Kembali ke pilihan pendamping" onClick={() => setDetails(false)}><ChevronLeft size={22} /></button>}
        <span className="signin-brand">Momong · {details ? "Langkah 2 dari 2" : "Langkah 1 dari 2"}</span>
        <h1 ref={heading} tabIndex={-1}>{details ? mode === "pregnant" ? "Kenalan dulu, yuk" : "Kenalan dengan si kecil" : "Momong menemani apa?"}</h1>
        <p className="muted">{details ? "Isi beberapa detail supaya catatanmu sesuai kebutuhan." : "Pilih yang kamu butuhkan sekarang. Bisa diganti nanti di Profil."}</p>
      </header>

      <div className="onboarding-progress" role="progressbar" aria-label="Langkah pengaturan" aria-valuemin={1} aria-valuemax={2} aria-valuenow={details ? 2 : 1}>
        <span data-complete="true" /><span data-complete={details} />
      </div>
      {error && <p role="alert">{error}</p>}
      <div ref={body}>
      {!details ? (
        <div className="stack" role="group" aria-label="Pilihan pendamping">
          <button type="button" className="card onboarding-choice" aria-pressed={mode === "pregnant"} onClick={() => setMode("pregnant")}>
            <span className="glyph blue" aria-hidden="true"><Heart size={24} /></span>
            <span className="grow"><span className="card-title">Pendamping kehamilan</span><span className="card-sub">Pantau HPL, kontraksi, gerakan, dan gejala.</span></span>
            <span className="onboarding-selected" aria-hidden="true"><Check size={16} /></span>
          </button>
          <button type="button" className="card onboarding-choice" aria-pressed={mode === "postpartum"} onClick={() => setMode("postpartum")}>
            <span className="glyph peach" aria-hidden="true"><Baby size={24} /></span>
            <span className="grow"><span className="card-title">Catatan newborn</span><span className="card-sub">Catat minum susu, menyusu langsung, pumping, dan ganti popok.</span></span>
            <span className="onboarding-selected" aria-hidden="true"><Check size={16} /></span>
          </button>
          <button type="button" className="btn btn-signin lg block onboarding-continue" disabled={!mode} onClick={() => setDetails(true)}>Lanjut</button>
        </div>
      ) : (
        <form onSubmit={start} className="stack">
          <label className="field">
            <span>Nama ibu</span>
            <input className="input" autoComplete="given-name" required pattern={String.raw`.*\S.*`} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            <small className="muted">{user ? "Dari nama akunmu. Bisa kamu ubah." : "Nama yang ingin ditampilkan di catatan."}</small>
          </label>
          {mode === "pregnant" ? (
            <label className="field"><span>HPL (hari perkiraan lahir)</span><DateInput required value={hpl} onChange={(e) => setHpl(e.target.value)} /></label>
          ) : (
            <>
              <label className="field"><span>Nama anak</span><input className="input" required pattern={String.raw`.*\S.*`} maxLength={120} value={babyName} onChange={(e) => setBabyName(e.target.value)} placeholder="Nama si kecil" /></label>
              <label className="field"><span>Tanggal lahir anak</span><DateInput required max={todayISO()} value={birth} onChange={(e) => setBirth(e.target.value)} /></label>
            </>
          )}
          <button type="submit" className="btn btn-signin lg block">Mulai pakai Momong</button>
        </form>
      )}
      </div>
    </div>
  );
}
