import { Upload, AlertCircle } from "lucide-react";
import { useRef, useState } from "react";
import { deviceHasData, parseBackup, restoreBackup, type Backup } from "../store";
import { Sheet } from "../ui";

export function RestoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const reading = useRef(false);
  const blocked = deviceHasData();
  return <Sheet open={open} onOpenChange={onOpenChange} title="Pulihkan cadangan">
    <div className="stack">
      <p className="muted">Gunakan file JSON yang diekspor dari Momong. Akun dan akses Plus tidak termasuk dalam cadangan.</p>
      {blocked ? <p className="muted">Perangkat ini sudah berisi catatan. Pemulihan hanya tersedia di perangkat kosong agar catatanmu tidak tertimpa.</p> : <>
        <input ref={input} type="file" hidden accept=".json,application/json" aria-label="File cadangan Momong" onChange={async (e) => {
          const file = e.target.files?.[0]; e.target.value = "";
          if (!file || reading.current) return;
          reading.current = true; setBusy(true); setError(""); setBackup(null); setFilename("");
          try {
            if (file.size > 5 * 1024 * 1024) throw new Error("File terlalu besar. Maksimal 5 MiB.");
            setBackup(parseBackup(await file.text())); setFilename(file.name);
          } catch (err) { setError((err as Error).message); }
          finally { reading.current = false; setBusy(false); }
        }} />
        <button type="button" className="btn btn-soft block" disabled={busy} onClick={() => input.current?.click()}><Upload size={18} aria-hidden="true" />{busy ? "Membaca cadangan…" : backup ? "Pilih file lain" : "Pilih file cadangan"}</button>
        <small className="muted">JSON · maksimal 5 MiB</small>
        {backup && <section className="card solid stack" aria-label="Konfirmasi pemulihan">
          <p className="backup-filename">{filename}</p>
          <p className="muted">{backup.records} catatan, termasuk catatan yang sudah dihapus, akan dipulihkan ke perangkat ini.</p>
          <button type="button" className="btn btn-ink block" disabled={busy} onClick={() => {
            try { restoreBackup(backup); location.hash = "#/"; location.reload(); }
            catch (err) { setError((err as Error).message); }
          }}>Pulihkan {backup.records} catatan</button>
        </section>}
      </>}
      {error && <p className="restore-error" role="alert"><AlertCircle size={18} aria-hidden="true" />{error}</p>}
      <button type="button" className="link-btn" onClick={() => onOpenChange(false)}>Batal</button>
    </div>
  </Sheet>;
}
