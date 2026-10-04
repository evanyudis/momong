import { Check, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { list, put, remove, useDB } from "../store";
import { TopBar } from "../ui";

/** Free: make the list. Claim + share with family is Plus (not in the Free MVP). */
export function Wishlist() {
  useDB();
  const [label, setLabel] = useState("");
  const items = list("wishlist").sort((a, b) => a.at - b.at);
  const have = items.filter((i) => i.have).length;

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
                  <span className="grow" style={{ color: i.have ? "var(--ink-muted)" : undefined }}>{i.label}</span>
                  <button className="icon-btn" aria-label={`Hapus ${i.label}`} onClick={() => remove("wishlist", i.id)}><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
          )}
        </section>
        <form className="row" onSubmit={add}>
          <input className="input" placeholder="Tambah barang" maxLength={120} value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className="icon-btn" aria-label="Tambah" style={{ width: 52, height: 52 }}><Plus size={22} /></button>
        </form>
        <p className="faint" style={{ fontSize: 13, textAlign: "center" }}>Tersinkron dengan pasangan kalau kalian sudah terhubung.</p>
      </div>
    </>
  );
}
