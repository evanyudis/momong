import { Check, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { activeBabyId, isPlus, list, put, remove, useDB } from "../store";
import { api, useAccount } from "../sync";
import { toast, TopBar } from "../ui";

/** Free: make the list. Claim + share with family is Plus (not in the Free MVP). */
export function Wishlist() {
  useDB();
  const acc = useAccount();
  const key = `bb_wishlist_share:${acc.me?.household.id}:${activeBabyId()}`;
  const [share, setShare] = useState<string | null>(() => localStorage.getItem(key));
  const [claims, setClaims] = useState<SharedItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const items = list("wishlist").sort((a, b) => a.at - b.at);
  const have = items.filter((i) => i.have).length;

  useEffect(() => { setShare(localStorage.getItem(key)); setClaims([]); }, [key]);
  useEffect(() => {
    if (!share) return;
    let cancelled = false;
    api<{ items: SharedItem[] }>(`/wishlist/shared/${encodeURIComponent(share)}`).then(({ data }) => { if (!cancelled && Array.isArray(data.items)) setClaims(data.items); }).catch(() => {});
    return () => { cancelled = true; };
  }, [share]);

  async function publish() {
    if (busy) return;
    if (!isPlus()) { location.hash = "#/plus"; return; }
    setBusy(true);
    try {
      const { data } = await api<{ token: string; url: string }>("/wishlist/shares", { method: "POST", body: JSON.stringify({ babyId: activeBabyId(), items: items.filter((i) => !i.have).map((i) => ({ id: i.id, label: i.label })) }) });
      localStorage.setItem(key, data.token); setShare(data.token);
      if (navigator.share) await navigator.share({ title: "Daftar kado BumpBuddy", url: data.url });
      else { await navigator.clipboard.writeText(data.url); toast("Tautan daftar kado disalin"); }
    } catch { toast("Daftar belum dibagikan. Cek koneksi atau izin berbagi, lalu coba lagi."); }
    finally { setBusy(false); }
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    put("wishlist", { label: label.trim().slice(0, 120), have: false, at: Date.now() });
    setLabel("");
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
                <div key={i.id} className="list-row">
                  <button
                    className="check" role="checkbox" aria-checked={!!i.have} aria-label={`${i.label} sudah ada`}
                    onClick={() => put("wishlist", { id: i.id, have: !i.have })}
                  >
                    <Check size={16} strokeWidth={3} />
                  </button>
                  <span className="grow" style={{ color: i.have ? "var(--ink-muted)" : undefined }}>{i.label}{claims.find((c) => c.id === i.id)?.claimedBy && <span className="sub" style={{ display: "block" }}>Dipilih oleh {claims.find((c) => c.id === i.id)!.claimedBy}</span>}</span>
                  <button className="icon-btn" aria-label={`Hapus ${i.label}`} onClick={() => remove("wishlist", i.id)}><Trash2 size={18} /></button>
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
          <button className="btn btn-soft block" disabled={busy || items.length > 100} onClick={publish}>{busy ? "Membagikan…" : "Bagikan lewat tautan"}</button>
          {items.length > 100 && <p className="muted">Maksimal 100 barang per daftar yang dibagikan.</p>}
          {share && <>
            <a className="link-btn" href={`#/kado-bersama?token=${encodeURIComponent(share)}`}>Lihat daftar yang dibagikan</a>
            <button className="btn btn-soft block" disabled={busy} onClick={async () => {
              setBusy(true);
              try { await api(`/wishlist/shares/${encodeURIComponent(share)}`, { method: "DELETE" }); localStorage.removeItem(key); setShare(null); setClaims([]); toast("Tautan dinonaktifkan"); }
              catch { toast("Tautan belum bisa dinonaktifkan. Coba lagi saat online."); }
              finally { setBusy(false); }
            }}>Nonaktifkan tautan</button>
          </>}
        </section>
        <p className="faint" style={{ fontSize: 13, textAlign: "center" }}>Tersinkron dengan pasangan kalau kalian sudah terhubung.</p>
      </div>
    </>
  );
}

export type SharedItem = { id: string; label: string; claimedBy: string | null };
export function SharedWishlist({ token }: { token: string | null }) {
  const [items, setItems] = useState<SharedItem[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!token) { setError("Tautan tidak lengkap. Minta tautan baru dari pemilik daftar."); return; }
    api<{ items: SharedItem[] }>(`/wishlist/shared/${encodeURIComponent(token)}`).then(({ data }) => {
      if (!Array.isArray(data.items)) throw new Error("invalid_response");
      if (!cancelled) { setItems(data.items); setError(""); }
    }).catch(() => { if (!cancelled) setError("Daftar belum tersedia. Tautan mungkin kedaluwarsa atau dinonaktifkan; cek koneksi lalu coba lagi."); });
    return () => { cancelled = true; };
  }, [token, round]);
  return <><TopBar title="Daftar kado bersama" /><div className="stack">
    <p className="muted">Pilih barang yang ingin kamu hadiahkan. Nama kamu terlihat oleh orang yang membuka tautan ini.</p>
    <label className="field"><span>Nama pemberi kado</span><input className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    {!items && !error && <p role="status">Memuat daftar…</p>}
    <button className="btn btn-soft block" onClick={() => setRound((r) => r + 1)}>Perbarui daftar</button>
    {items?.length === 0 && <p className="muted">Belum ada barang yang perlu dihadiahkan.</p>}
    {items?.map((item) => <section className="card solid stack" key={item.id}>
      <h2>{item.label}</h2>
      {item.claimedBy ? <p className="muted">Dipilih oleh {item.claimedBy}</p> : <button className="btn btn-ink block" disabled={busy || !name.trim()} onClick={async () => {
        setBusy(true); setError("");
        try { await api(`/wishlist/shared/${encodeURIComponent(token!)}/claims`, { method: "POST", body: JSON.stringify({ itemId: item.id, name: name.trim() }) }); setRound((r) => r + 1); }
        catch { setError("Barang belum bisa dipilih. Mungkin sudah dipilih orang lain; perbarui daftar."); }
        finally { setBusy(false); }
      }}>Saya hadiahkan ini</button>}
    </section>)}
  </div></>;
}
