import { Check, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { BAG_DEFAULTS } from "../content";
import { get, list, put, remove, useDB } from "../store";
import { TopBar } from "../ui";

export function Bag() {
  useDB();
  const [label, setLabel] = useState("");
  const custom = list("bag").filter((r) => r.custom).sort((a, b) => a.at - b.at);
  const items = [
    ...BAG_DEFAULTS.map((d) => ({ id: d.id, label: d.label, group: d.group as string, custom: false, checked: !!get("bag", d.id)?.checked })),
    ...custom.map((r) => ({ id: r.id, label: r.label as string, group: "Tambahan", custom: true, checked: !!r.checked })),
  ];
  const groups = ["Dokumen", "Bunda", "Bayi", "Tambahan"].filter((g) => items.some((i) => i.group === g));
  const done = items.filter((i) => i.checked).length;

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    put("bag", { custom: true, label: label.trim(), checked: false, at: Date.now() });
    setLabel("");
  }

  return (
    <>
      <TopBar title="Tas RS" />
      <p className="muted num" style={{ marginBottom: 16 }}>{done} dari {items.length} siap</p>
      <div className="stack">
        {groups.map((g) => (
          <section key={g} className="card solid">
            <div className="label">{g}</div>
            <div className="list" style={{ marginTop: 4 }}>
              {items.filter((i) => i.group === g).map((i) => (
                <div key={i.id} className="list-row">
                  <button
                    className="check" role="checkbox" aria-checked={i.checked} aria-label={i.label}
                    onClick={() => put("bag", { id: i.id, checked: !i.checked })}
                  >
                    {i.checked && <Check size={16} strokeWidth={3} />}
                  </button>
                  <span className="grow" style={{ color: i.checked ? "var(--ink-muted)" : undefined }}>{i.label}</span>
                  {i.custom && <button className="icon-btn" aria-label={`Hapus ${i.label}`} onClick={() => remove("bag", i.id)}><Trash2 size={18} /></button>}
                </div>
              ))}
            </div>
          </section>
        ))}
        <form className="row" onSubmit={add}>
          <input className="input" placeholder="Tambah barang" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className="icon-btn" aria-label="Tambah" style={{ width: 52, height: 52 }}><Plus size={22} /></button>
        </form>
      </div>
    </>
  );
}
