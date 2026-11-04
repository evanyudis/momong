import { useEffect, useState } from "react";
import { DELETE_CONFIRM, canSubmit, deleteBody, deleteErrorCopy, type DeletionPreview } from "../delete-account";
import { todayISO } from "../dates";
import { exportJSON } from "../store";
import { ApiError, deleteAccount, loadDeletionPreview, reauthForDeletion, useAccount } from "../sync";
import { TopBar, toast } from "../ui";

/** Profil → Hapus akun. Copy follows Kebijakan Privasi pasal 10–11. */
export function HapusAkun() {
  const acc = useAccount();
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [ack, setAck] = useState(false);
  const [wipe, setWipe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!acc.token) return;
    let live = true;
    setLoadError("");
    loadDeletionPreview()
      .then((p) => { if (live) p ? setPreview(p) : setLoadError(deleteErrorCopy("")); })
      .catch((e) => { if (live) setLoadError(deleteErrorCopy(e instanceof ApiError ? e.code : "")); });
    return () => { live = false; };
  }, [acc.token]);

  function download() {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `momong-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function submit() {
    if (!preview || busy || !canSubmit(preview, { confirm, password, acknowledgePlusLoss: ack })) return;
    setBusy(true); setError("");
    try {
      await deleteAccount(deleteBody(preview, { confirm, password, acknowledgePlusLoss: ack }), wipe);
      toast("Akunmu sudah dihapus.");
      location.replace(`${location.pathname}#/`);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "";
      setError(deleteErrorCopy(code));
      if (code === "reauth_required") setPreview({ ...preview, sessionFresh: false });
      setBusy(false);
    }
  }

  if (!acc.token) return <>
    <TopBar title="Hapus akun" back="#/profil" />
    <section className="card solid stack"><p>Masuk dulu untuk menghapus akun.</p><a className="btn btn-ink block" href="#/masuk-akun">Masuk</a></section>
  </>;

  return <>
    <TopBar title="Hapus akun" back="#/profil" />
    <div className="stack">
      <section className="card solid stack">
        <h1 style={{ fontSize: 22 }}>Hapus akun permanen?</h1>
        <p className="muted">Akun yang sudah dihapus tidak bisa dikembalikan.</p>
      </section>
      {loadError && <p role="alert">{loadError}</p>}
      {!preview && !loadError && <p role="status">Memeriksa akun…</p>}
      {preview && <>
        <section className="card solid stack">
          <div className="card-title">Yang dihapus</div>
          <ul className="card-sub">
            <li>Akun, email login, dan semua sesi masuk, termasuk tautan Google.</li>
            {preview.hasPartner
              ? <li>Keanggotaanmu di household. Pasanganmu jadi pemilik household.</li>
              : <li>Household dan semua catatan yang tersinkron di server.</li>}
          </ul>
          <div className="card-title">Yang tetap disimpan</div>
          <ul className="card-sub">
            <li>Catatan order pembayaran, 10 tahun untuk pajak. Order dilepas dari akun dan identitasmu.</li>
            {preview.hasPartner && <li>Catatan bersama tetap ada untuk pasanganmu.</li>}
            <li>Cadangan server sampai 14 hari, lalu terhapus otomatis.</li>
          </ul>
          <p className="card-sub">Detailnya di <a className="inline-link" href="#/kebijakan-privasi">Kebijakan Privasi</a>.</p>
        </section>

        {preview.blocked && <section className="card solid stack" role="alert"><div className="card-title">Belum bisa dihapus</div><p className="card-sub">{deleteErrorCopy(preview.blocked)}</p><a className="btn btn-soft block" href="#/plus">Buka Plus</a></section>}

        {!preview.blocked && <section className="card solid stack">
          {preview.plusLossNeedsAck && <>
            <div className="card-title">Plus ikut hilang</div>
            <p className="card-sub">Akses Plus di household ini hilang bersama akunmu dan tidak bisa dipindah. Dana tidak kembali otomatis. Kalau mau refund, ajukan dulu sebelum hapus akun.</p>
            <label className="plus-consent"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /><span>Saya paham Plus ikut hilang</span></label>
          </>}

          <label className="plus-consent"><input type="checkbox" checked={wipe} onChange={(e) => setWipe(e.target.checked)} /><span>Hapus juga catatan di HP ini</span></label>
          <p className="card-sub">{wipe ? "HP ini kembali kosong seperti baru dipasang." : "Catatan tetap ada di HP ini, tanpa akun."} <button type="button" className="inline-link link-btn" onClick={download}>Ekspor JSON dulu</button></p>

          {preview.hasPassword
            ? <label className="field"><span>Password</span><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            : !preview.sessionFresh && <div className="stack">
              <p className="card-sub">Demi keamanan, masuk ulang dulu. Setelah itu kamu dibawa balik ke sini.</p>
              <button type="button" className="btn btn-soft block" onClick={() => { void reauthForDeletion().then(() => { location.hash = "#/masuk-akun"; }); }}>Masuk ulang</button>
            </div>}

          <label className="field"><span>Ketik {DELETE_CONFIRM} untuk lanjut</span><input className="input" autoComplete="off" autoCapitalize="characters" spellCheck={false} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
          {error && <p role="alert">{error}</p>}
          <button type="button" className="btn btn-danger-solid block" disabled={busy || !canSubmit(preview, { confirm, password, acknowledgePlusLoss: ack })} onClick={() => void submit()}>
            {busy ? "Menghapus…" : "Hapus akun permanen"}
          </button>
          <a className="btn btn-soft block" href="#/profil">Batal</a>
        </section>}
      </>}
    </div>
  </>;
}
