import { PLUS_ENABLED } from "../release";
import { Check, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { activeBabyId, isPlus, list, put, remove, useDB } from "../store";
import { ApiError, api, useAccount } from "../sync";
import { DeleteButton, toast, PlusSheet, TopBar } from "../ui";

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    addEventListener("online", update); addEventListener("offline", update);
    return () => { removeEventListener("online", update); removeEventListener("offline", update); };
  }, []);
  return online;
}

/** Free: make the list. Claim + share with family is Plus (not in the Free MVP). */
export function Wishlist() {
  useDB();
  const acc = useAccount();
  const online = useOnline();
  const alive = useRef(true);
  const lock = useRef(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const key = `bb_wishlist_share:${acc.me?.household.id}:${activeBabyId()}`;
  const [plus, setPlus] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [shareError, setShareError] = useState("");
  const [share, setShare] = useState<string | null>(() => localStorage.getItem(key));
  const [claims, setClaims] = useState<SharedItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [savedRow, setSavedRow] = useState<string | null>(null);
  const items = list("wishlist").sort((a, b) => a.at - b.at);
  const have = items.filter((i) => i.have).length;

  useEffect(() => { setShare(localStorage.getItem(key)); setClaims([]); }, [key]);
  useEffect(() => {
    if (!share || !online || !isPlus()) return;
    setLoading(true);
    let cancelled = false;
    api<{ items: SharedItem[]; expiresAt: string }>(`/wishlist/shared/${encodeURIComponent(share)}`).then(({ data }) => { if (!cancelled && Array.isArray(data.items)) { setClaims(data.items); setExpiresAt(data.expiresAt); setShareError(""); } }).catch(() => { if (!cancelled) setShareError("Tautan belum tersedia atau sudah kedaluwarsa. Publikasikan lagi untuk memperbarui."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [share, refresh, online]);

  async function publish() {
    if (lock.current) return;
    if (!isPlus()) { setPlus(true); return; }
    if (!online) { setShareError("Sambungkan internet untuk mempublikasikan daftar."); return; }
    lock.current = true; setBusy(true); setShareError("");
    try {
      const { data } = await api<{ token: string; url: string; expiresAt: string }>("/wishlist/shares", { method: "POST", body: JSON.stringify({ babyId: activeBabyId(), items: items.filter((i) => !i.have).map((i) => ({ id: i.id, label: i.label })) }) });
      if (!alive.current) return;
      localStorage.setItem(key, data.token); setShare(data.token); setExpiresAt(data.expiresAt);
      setRefresh((n) => n + 1); toast("Daftar dipublikasikan. Pilih cara berbagi di bawah.");
    } catch { if (alive.current) setShareError("Daftar belum dibagikan. Cek koneksi atau izin berbagi, lalu coba lagi."); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    try {
      const title = label.trim().slice(0, 120);
      const record = put("wishlist", { label: title, have: false, at: Date.now() });
      setSavedRow(record.id); setLabel(""); setShareError(""); toast(`${title} ditambahkan ke daftar kado`);
    } catch { setShareError("Barang belum tersimpan. Coba lagi."); }
  }

  return (
    <>
      <TopBar title="Daftar kado" />
      <p className="muted num" style={{ marginBottom: 16 }}>
        {items.length ? `${have} dari ${items.length} sudah ada` : "Catat barang yang masih dibutuhkan si kecil."}
      </p>
      <div className="stack">
        <section className="card solid">
          {items.length === 0 ? (
            <div className="empty"><strong>Belum ada barang</strong>Misal: stroller, baby monitor, sterilizer botol.</div>
          ) : (
            <div className="list">
              {items.map((i) => (
                <div key={i.id} className={savedRow === i.id ? "list-row row-ack" : "list-row"}>
                  <label className="check-label">
                    <span className="check-box"><input type="checkbox" className="check" checked={!!i.have} onChange={(e) => {
                      try { put("wishlist", { id: i.id, have: e.target.checked }); setShareError(""); }
                      catch { setShareError("Perubahan belum tersimpan. Coba lagi."); }
                    }} /><Check size={16} strokeWidth={3} aria-hidden="true" /></span>
                    <span className="grow">{i.label}{isPlus() && claims.find((c) => c.id === i.id)?.claimedBy && <span className="sub" style={{ display: "block" }}>Dipilih oleh {claims.find((c) => c.id === i.id)!.claimedBy}</span>}</span>
                  </label>
                  <DeleteButton label={i.label} onDelete={() => remove("wishlist", i.id)} />
                </div>
              ))}
            </div>
          )}
        </section>
        <form className="row" onSubmit={add}>
          <input aria-label="Nama barang" className="input" placeholder="Tambah barang" maxLength={120} value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className="icon-btn" aria-label="Tambah" style={{ width: 52, height: 52 }}><Plus size={22} /></button>
        </form>
        <section className="card solid stack">
          <h2>Bagikan daftar kado · Plus</h2>
          <p className="muted">Hanya barang yang belum tersedia dan nama pemberi kado yang dibagikan lewat tautan. Catatan kesehatan tetap pribadi. Tautan berlaku 7 hari; bagikan lagi untuk memperbarui daftar.</p>
          <button className="btn btn-soft block" disabled={!PLUS_ENABLED && !isPlus() || busy || isPlus() && !online || items.filter((i) => !i.have).length > 100} onClick={publish}>{!PLUS_ENABLED && !isPlus() ? "Segera hadir" : busy ? "Membagikan…" : "Publikasikan daftar"}</button>
          {items.filter((i) => !i.have).length > 100 && <p className="muted">Maksimal 100 barang per daftar yang dibagikan.</p>}
          {!online && <p role="status">Kamu offline. Daftar lokal tetap dapat diedit; publish, claim, refresh, dan menonaktifkan tautan membutuhkan internet.</p>}
          {loading && <p role="status">Memeriksa daftar dan claim…</p>}
          {expiresAt && <p className="muted">Tautan berlaku hingga {new Date(expiresAt).toLocaleString("id-ID")}.</p>}
          {shareError && <p role="status">{shareError}</p>}
          {share && <>
            {isPlus() && !shareError && <>
            <a className="btn btn-coral block" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent("Daftar kado Momong: " + location.origin + "/#/kado-bersama?token=" + encodeURIComponent(share))}`}>Bagikan ke WhatsApp</a>
            <button className="btn btn-soft block" onClick={async () => {
              const url = location.origin + "/#/kado-bersama?token=" + encodeURIComponent(share);
              try { if (navigator.share) await navigator.share({ title: "Daftar kado Momong", url }); else { await navigator.clipboard.writeText(url); toast("Tautan disalin"); } }
              catch { toast("Berbagi dibatalkan atau belum tersedia."); }
            }}>Bagikan</button>
            <button className="btn btn-soft block" onClick={async () => {
              try { await navigator.clipboard.writeText(location.origin + "/#/kado-bersama?token=" + encodeURIComponent(share)); toast("Tautan disalin"); }
              catch { toast("Salin tautan belum diizinkan browser."); }
            }}>Salin tautan</button>
            <a className="link-btn" href={`#/kado-bersama?token=${encodeURIComponent(share)}`}>Lihat daftar yang dibagikan</a>
            </>}
            {isPlus() && <button className="btn btn-soft block" disabled={!online || loading} onClick={() => setRefresh((n) => n + 1)}>Perbarui claim</button>}
            <button className="btn btn-soft block" disabled={busy || !online} onClick={async () => {
              if (lock.current) return;
              lock.current = true; setBusy(true);
              try { await api(`/wishlist/shares/${encodeURIComponent(share)}`, { method: "DELETE" }); localStorage.removeItem(key); if (!alive.current) return; setShare(null); setClaims([]); setExpiresAt(null); setShareError(""); toast("Tautan dinonaktifkan"); }
              catch { if (alive.current) setShareError("Tautan belum bisa dinonaktifkan. Coba lagi saat online."); }
              finally { lock.current = false; if (alive.current) setBusy(false); }
            }}>Nonaktifkan tautan</button>
          </>}
        </section>
        <p className="faint" style={{ fontSize: 13, textAlign: "center" }}>Tersinkron dengan pasangan kalau kalian sudah terhubung.</p>
      </div>
      <PlusSheet variant={plus ? "overview" : null} onClose={() => setPlus(false)} />
    </>
  );
}

export type SharedItem = { id: string; label: string; claimedBy: string | null };
export function SharedWishlist({ token }: { token: string | null }) {
  const online = useOnline();
  const lock = useRef(false);
  const [items, setItems] = useState<SharedItem[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [savedItem, setSavedItem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!online) return;
    if (!token) { setError("Tautan tidak lengkap. Minta tautan baru dari pemilik daftar."); return; }
    api<{ items: SharedItem[] }>(`/wishlist/shared/${encodeURIComponent(token)}`).then(({ data }) => {
      if (!Array.isArray(data.items)) throw new Error("invalid_response");
      if (!cancelled) { setItems(data.items); setError(""); }
    }).catch(() => { if (!cancelled) setError("Daftar belum tersedia. Tautan mungkin kedaluwarsa atau dinonaktifkan; cek koneksi lalu coba lagi."); });
    return () => { cancelled = true; };
  }, [token, round, online]);
  return <><TopBar title="Daftar kado bersama" /><div className="stack">
    <p className="muted">Pilih barang yang ingin kamu hadiahkan. Nama kamu terlihat oleh orang yang membuka tautan ini.</p>
    <label className="field"><span>Nama pemberi kado</span><input className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></label>
    {!online && <p role="status">Daftar dan claim membutuhkan internet. Sambungkan koneksi untuk melanjutkan.</p>}
    {error && <p role="alert">{error}</p>}
    {!items && !error && <p role="status">Memuat daftar…</p>}
    <button className="btn btn-soft block" disabled={!online || busy} onClick={() => setRound((r) => r + 1)}>Perbarui daftar</button>
    {items?.length === 0 && <p className="muted">Belum ada barang yang perlu dihadiahkan.</p>}
    {items?.map((item) => <section className={savedItem === item.id ? "card solid stack row-ack" : "card solid stack"} key={item.id}>
      <h2>{item.label}</h2>
      {item.claimedBy ? <p className="muted">Dipilih oleh {item.claimedBy}</p> : <button className="btn btn-ink block" disabled={busy || !online || !name.trim()} onClick={async () => {
        if (lock.current) return;
        lock.current = true; setBusy(true); setError("");
        try { await api(`/wishlist/shared/${encodeURIComponent(token!)}/claims`, { method: "POST", body: JSON.stringify({ itemId: item.id, name: name.trim() }) }); setSavedItem(item.id); setRound((r) => r + 1); toast(`${item.label} dipilih sebagai kado`); }
        catch (e) {
          if (e instanceof ApiError && e.status === 409) { toast("Barang sudah dipilih orang lain. Daftar diperbarui."); setRound((r) => r + 1); }
          else setError("Barang belum bisa dipilih. Cek koneksi atau minta tautan baru.");
        }
        finally { lock.current = false; setBusy(false); }
      }}>Saya hadiahkan ini</button>}
    </section>)}
  </div></>;
}
