import { PLUS_ENABLED } from "../release";
import { useRef, useState } from "react";
import { activeBabyId, settings, getPrefs, isPlus, setPrefs, uid, useDB } from "../store";
import { DateInput, toast, TopBar } from "../ui";

export function Reminders() {
  useDB();
  const [editing, setEditing] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [savedRow, setSavedRow] = useState<string | null>(null);
  const labelInput = useRef<HTMLInputElement>(null);
  const prefs = getPrefs();
  const all = prefs.reminders ?? [];
  const items = all.filter((r) => r.babyId === activeBabyId()).sort((a, b) => a.at - b.at);
  return <>
    <TopBar title="Pengingat" back="#/profil" />
    <div className="stack">
      <p className="muted">Profil: {settings().babyName || "Si kecil"}.</p>
      <p className="muted">Pengingat di perangkat ini berjalan saat aplikasi terbuka. Saat kembali ke aplikasi, pengingat yang terlewat akan ditampilkan.</p>
      {!PLUS_ENABLED && !isPlus() ? <button className="btn btn-coral block" disabled>Segera hadir</button> : !isPlus() ? <a className="btn btn-coral block" href="#/plus">Buka pengingat dengan Plus</a> : <>
        <form className="card solid stack" onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const title = String(form.get("label") ?? "").trim();
          const at = new Date(String(form.get("at") ?? "")).getTime();
          if (!title || !Number.isFinite(at) || at <= Date.now()) return setError("Isi nama dan pilih waktu setelah sekarang.");
          try {
          const id = editing ?? uid();
          setPrefs({ reminders: [...all.filter((r) => r.id !== editing), { id, babyId: activeBabyId(), label: title.slice(0, 120), at }] });
          setSavedRow(id);
          setEditing(null);
          setLabel(""); setDate(""); setError("");
          toast(`Pengingat “${title.slice(0, 120)}” ${editing ? "diperbarui" : "tersimpan"}`);
          } catch { setError("Pengingat belum tersimpan. Coba lagi."); }
        }}>
          <label className="field"><span>Nama pengingat</span><input ref={labelInput} className="input" name="label" required maxLength={120} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Misal: pompa atau vitamin" /></label>
          <label className="field"><span>Waktu</span><DateInput name="at" type="datetime-local" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <button className="btn btn-ink block">{editing ? "Simpan perubahan" : "Simpan pengingat"}</button>
          {editing && <button type="button" className="btn btn-soft block" onClick={() => { setEditing(null); setLabel(""); setDate(""); }}>Batal edit</button>}
        </form>
        <button className="btn btn-soft block" onClick={async () => {
          setError("");
          if (prefs.notifyReminders) return setPrefs({ notifyReminders: false });
          if (!("Notification" in window)) return setError("Browser ini belum mendukung notifikasi. Pengingat di aplikasi tetap tersedia.");
          let permission: NotificationPermission;
          try { permission = await Notification.requestPermission(); }
          catch { return setError("Izin notifikasi belum bisa diminta. Pengingat di aplikasi tetap tersedia."); }
          setPrefs({ notifyReminders: permission === "granted" });
          if (permission !== "granted") setError("Notifikasi belum diizinkan. Pengingat di aplikasi tetap tersedia.");
        }}>{prefs.notifyReminders ? "Matikan notifikasi perangkat" : "Izinkan notifikasi perangkat"}</button>
        {error && <p role="status">{error}</p>}
        <section className="card solid stack">
          <h2>Pengingat tersimpan</h2>
          {!items.length && <p className="muted">Belum ada pengingat. Tambahkan nama dan waktunya di atas.</p>}
          {items.map((r) => <div className={savedRow === r.id ? "spread row-ack" : "spread"} key={r.id}><div><div className="title">{r.label}</div><div className="sub">{new Date(r.at).toLocaleString("id-ID")}{r.firedAt ? " · Sudah ditampilkan" : ""}</div></div><button className="btn btn-soft sm" aria-label={`Edit pengingat ${r.label}`} onClick={() => {
            setEditing(r.id); setLabel(r.label);
            const local = new Date(r.at - new Date(r.at).getTimezoneOffset() * 60000);
            setDate(local.toISOString().slice(0, 16));
            setError("");
            labelInput.current?.focus({ preventScroll: true });
            window.scrollTo({ top: 0, behavior: "instant" });
          }}>Edit</button><button className="btn btn-soft sm" aria-label={`Hapus pengingat ${r.label}`} onClick={() => setPrefs({ reminders: all.filter((item) => item.id !== r.id) })}>Hapus</button></div>)}
        </section>
      </>}
    </div>
  </>;
}
