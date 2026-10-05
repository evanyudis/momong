import { useEffect, useState } from "react";
import { deviceHasData, exportJSON } from "../store";
import { todayISO } from "../dates";
import { Sheet } from "../ui";

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let installPrompt: InstallPrompt | null = null;
window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); installPrompt = event as InstallPrompt; });
export function InstallSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [platform, setPlatform] = useState(/iPad|iPhone/.test(navigator.userAgent) ? "ios" : /Android/.test(navigator.userAgent) ? "android" : "desktop");
  const [installed, setInstalled] = useState(matchMedia("(display-mode: standalone)").matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
  const [available, setAvailable] = useState(!!installPrompt);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const done = () => { setInstalled(true); installPrompt = null; };
    const ready = () => setAvailable(true);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("appinstalled", done); window.removeEventListener("beforeinstallprompt", ready); };
  }, []);
  function backup() {
    const url = URL.createObjectURL(new Blob([exportJSON()], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `momong-${todayISO()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Simpan file ini. Di aplikasi baru, pilih Pulihkan dari file cadangan.");
  }
  return <Sheet open={open} onOpenChange={onOpenChange} title={installed ? "Momong di layar utama" : "Tambahkan ke layar utama"}>
    {installed ? <p>Aplikasi sudah dibuka dari layar utama. Catatan tersimpan di perangkat ini.</p> : <div className="stack">
      <p className="muted">Buka Momong lebih cepat, termasuk saat offline setelah aplikasi selesai dimuat.</p>
      {deviceHasData() && <section className="card stack">
        <h3>Simpan catatan sebelum instalasi</h3>
        <p>Di iPhone dan iPad, browser dan aplikasi layar utama dapat memiliki penyimpanan terpisah. Catatan di browser asal tetap ada.</p>
        <button className="btn btn-ink block" onClick={backup}>Simpan cadangan</button>
        <a className="btn btn-soft block" href="#/pasangan" onClick={() => onOpenChange(false)}>Gunakan sinkron gratis</a>
        <small className="muted">Masuk, aktifkan sinkron, lalu tunggu status tersinkron sebelum membuka aplikasi baru.</small>
      </section>}
      <div className="segmented" style={{ "--n": 3, "--i": ["ios", "android", "desktop"].indexOf(platform) } as React.CSSProperties}>
        {[["ios", "iPhone/iPad"], ["android", "Android"], ["desktop", "Komputer"]].map(([id, label]) => <button key={id} aria-pressed={platform === id} onClick={() => setPlatform(id!)}>{label}</button>)}
      </div>
      <ol className="stack">
        {platform === "ios" ? <><li>Buka Momong di Safari, lalu ketuk Bagikan.</li><li>Pilih Tambahkan ke Layar Utama. Aktifkan Buka sebagai App Web jika tersedia.</li><li>Ketuk Tambah, lalu buka Momong dari layar utama.</li></> :
          platform === "android" ? <><li>Buka menu browser (⋮).</li><li>Pilih Instal aplikasi atau Tambahkan ke layar utama.</li><li>Konfirmasi instalasi dan buka Momong.</li></> :
          <><li>Buka Momong di Chrome, Edge, atau Safari.</li><li>Pilih ikon instalasi di address bar, atau menu Tambahkan ke Dock di Safari.</li><li>Konfirmasi dan buka Momong dari daftar aplikasi.</li></>}
      </ol>
      <p className="muted">Jika catatan belum muncul, pilih Pulihkan dari file cadangan di layar awal. Jangan hapus aplikasi atau data browser asal.</p>
      {available && installPrompt && <button className="btn btn-coral block" disabled={busy} onClick={async () => {
        if (!installPrompt || busy) return; setBusy(true);
        try { const prompt = installPrompt; await prompt.prompt(); const result = await prompt.userChoice;
          installPrompt = null; setAvailable(false); setMessage(result.outcome === "accepted" ? "Permintaan instalasi diterima. Buka Momong dari layar utama." : "Instalasi dibatalkan. Kamu bisa memakai panduan di atas.");
        } catch { setMessage("Instalasi belum tersedia. Gunakan panduan browser di atas."); }
        finally { setBusy(false); }
      }}>Instal Momong</button>}
      {message && <p role="status">{message}</p>}
    </div>}
    <button className="btn btn-soft block" style={{ marginTop: 16 }} onClick={() => onOpenChange(false)}>Selesai</button>
  </Sheet>;
}
