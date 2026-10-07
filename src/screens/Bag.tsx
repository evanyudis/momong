import { Check, Plus } from "lucide-react";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { BAG_DEFAULTS } from "../content";
import { get, list, put, remove, useDB } from "../store";
import { acknowledge, animate, instantMotion } from "../motion";
import { DeleteButton, toast, TopBar } from "../ui";

export function Bag() {
  useDB();
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [burst, setBurst] = useState<{ id: string; at: number } | null>(null);
  const progress = useRef<HTMLParagraphElement>(null);
  const changed = useRef(false);
  const custom = list("bag").filter((r) => r.custom).sort((a, b) => a.at - b.at);
  const items = [
    ...BAG_DEFAULTS.map((d) => ({ id: d.id, label: d.label, group: d.group as string, custom: false, checked: !!get("bag", d.id)?.checked })),
    ...custom.map((r) => ({ id: r.id, label: r.label as string, group: "Tambahan", custom: true, checked: !!r.checked })),
  ];
  const groups = ["Dokumen", "Bunda", "Bayi", "Tambahan"].filter((g) => items.some((i) => i.group === g));
  const done = items.filter((i) => i.checked).length;

  useLayoutEffect(() => {
    if (!changed.current) return;
    changed.current = false;
    return acknowledge(progress.current);
  }, [done]);
  const badge = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (complete) return animate(badge.current, [{ opacity: 0, transform: "scale(.97)" }, { opacity: 1, transform: "scale(1.02)", offset: .65 }, { opacity: 1, transform: "none" }], 480);
  }, [complete]);
  function toggle(id: string, checked: boolean) {
    try {
      changed.current = true;
      put("bag", { id, checked });
      setBurst(checked && !instantMotion() ? { id, at: performance.now() } : null);
      setComplete(checked && done + 1 === items.length);
      setError("");
    } catch { changed.current = false; setError("Perubahan belum tersimpan. Coba lagi."); }
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    try {
      put("bag", { custom: true, label: label.trim(), checked: false, at: Date.now() });
      setLabel(""); setComplete(false); setError(""); toast("Barang ditambahkan ke tas RS");
    } catch { setError("Barang belum tersimpan. Coba lagi."); }
  }

  return (
    <>
      <TopBar title="Tas RS" />
      <p ref={progress} className="muted num" style={{ marginBottom: 16 }}>{done} dari {items.length} siap</p>
      {error && <p role="alert">{error}</p>}
      {complete && done === items.length && <div ref={badge} className="completion" role="status"><Check size={22} aria-hidden="true" />Tas RS siap.</div>}
      <div className="stack">
        {groups.map((g) => (
          <section key={g} className="card solid">
            <div className="label">{g}</div>
            <div className="list" style={{ marginTop: 4 }}>
              {items.filter((i) => i.group === g).map((i) => (
                <div key={i.id} className="list-row">
                  <label className="check-label">
                    <span className="check-box"><input type="checkbox" className="check" checked={i.checked} onChange={(e) => toggle(i.id, e.target.checked)} /><Check size={16} strokeWidth={3} aria-hidden="true" />
                      {burst?.id === i.id && <span key={burst.at} className="check-confetti" aria-hidden="true" onAnimationEnd={() => setBurst(null)}>
                        {[[0, -27], [24, -15], [26, 13], [0, 25], [-25, 12], [-23, -16]].map(([x, y], n) => <i key={n} style={{ "--x": `${x}px`, "--y": `${y}px`, "--turn": `${n % 2 ? 100 : -80}deg` } as CSSProperties} />)}
                      </span>}
                    </span>
                    <span className="grow">{i.label}</span>
                  </label>
                  {i.custom && <DeleteButton label={i.label} onDelete={() => remove("bag", i.id)} />}
                </div>
              ))}
            </div>
          </section>
        ))}
        <form className="row" onSubmit={add}>
          <input className="input" aria-label="Nama barang" placeholder="Tambah barang" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className="icon-btn" aria-label="Tambah" style={{ width: 52, height: 52 }}><Plus size={22} /></button>
        </form>
      </div>
    </>
  );
}
