import { Baby, Heart } from "lucide-react";
import { useState } from "react";
import { todayISO } from "../dates";
import { saveSettings, setPrefs } from "../store";
import { API_URL } from "../sync";
import { DateInput } from "../ui";

/** First run: HPL is the one thing the pregnancy tools need. No account required. */
export function Welcome() {
  const [hpl, setHpl] = useState("");
  const [name, setName] = useState("");
  const [born, setBorn] = useState(false);
  const [birth, setBirth] = useState(todayISO());

  function start(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim()) setPrefs({ name: name.trim() });
    if (born) saveSettings({ birthMode: "postpartum", babyBirth: birth });
    else saveSettings({ birthMode: "pregnant", hpl });
  }

  return (
    <form onSubmit={start} className="stack" style={{ paddingTop: 24 }}>
      <div className="avatars" aria-hidden="true">
        <span className="avatar xl blue"><Heart size={38} /></span>
        <span className="avatar xl coral"><Baby size={40} /></span>
      </div>
      <h1 style={{ fontSize: 38, letterSpacing: "-0.035em", lineHeight: 1.08, marginTop: 12 }}>Selamat datang di BumpBuddy</h1>
      <p className="muted" style={{ fontSize: 17, lineHeight: 1.5 }}>
        Catat kontraksi, gerakan, dan gejala dengan tenang. Jalan offline, tanpa akun.
      </p>

      <section className="card solid stack" style={{ marginTop: 8 }}>
        <label className="field">
          <span>Nama panggilan</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bunda" />
        </label>
        {born ? (
          <label className="field">
            <span>Tanggal lahir si kecil</span>
            <DateInput max={todayISO()} required value={birth} onChange={(e) => setBirth(e.target.value)} />
          </label>
        ) : (
          <label className="field">
            <span>HPL (hari perkiraan lahir)</span>
            <DateInput required value={hpl} onChange={(e) => setHpl(e.target.value)} />
          </label>
        )}
      </section>

      <button className="btn btn-ink lg block">Mulai</button>
      <button type="button" className="link-btn muted" style={{ justifySelf: "center", fontWeight: 500 }} onClick={() => setBorn(!born)}>
        {born ? "Masih hamil? Isi HPL" : "Si kecil sudah lahir?"}
      </button>
      {API_URL && (
        <a className="link-btn muted" href="#/pasangan" style={{ justifySelf: "center", fontWeight: 500, textDecoration: "none" }}>
          Diundang pasangan? Masuk dulu
        </a>
      )}
    </form>
  );
}
