import { Baby, ChevronRight, Droplet, FileText, Hand, Milk, NotebookPen, Play, Plus, Square, Timer, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { DIAPER_LABEL, SIDE_LABEL, SYMPTOMS } from "../content";
import { durationLabel, isToday, pregnancy, timeLabel } from "../dates";
import { list, put, remove, type Rec, settings, useDB } from "../store";
import { Header, Sheet, toast } from "../ui";

export function Log() {
  useDB();
  return settings().birthMode === "postpartum" ? <NewbornLog /> : <PregnancyLog />;
}

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export function contractionStats(items: Rec[]) {
  const done = items.filter((c) => c.end).sort((a, b) => a.at - b.at);
  const avgDur = done.length ? done.reduce((n, c) => n + (c.end - c.at), 0) / done.length : 0;
  const gaps = done.slice(1).map((c, i) => c.at - done[i].at);
  const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  return { count: done.length, avgDur, avgGap };
}

function PregnancyLog() {
  const s = settings();
  const p = pregnancy(s.hpl!);
  const contractions = list("contractions");
  const running = contractions.find((c) => !c.end);
  const now = useNow(!!running);
  const today = contractions.filter((c) => isToday(c.at));
  const st = contractionStats(today);
  const [historyOpen, setHistoryOpen] = useState(false);

  const kick = list("kicks")[0];
  const kickActive = kick && !kick.done;
  const [symOpen, setSymOpen] = useState(false);
  const symToday = list("symptoms").filter((r) => isToday(r.at));

  function toggleContraction() {
    if (running) put("contractions", { id: running.id, end: Date.now() });
    else put("contractions", { at: Date.now() });
  }

  function addKick() {
    if (!kickActive) {
      put("kicks", { at: Date.now(), count: 1, last: Date.now() });
      return;
    }
    const count = kick.count + 1;
    const done = count >= 10;
    put("kicks", { id: kick.id, count, last: Date.now(), done });
    if (done) toast(`10 gerakan dalam ${durationLabel(Date.now() - kick.at)}`);
  }

  return (
    <>
      <Header title="Log Kehamilan" aside={<span className="pill" style={{ boxShadow: "var(--elevation-raised)", background: "transparent" }}>Minggu ke-{p.week}</span>} />
      <div className="stack">
        <section className="card">
          <button className="row" style={{ width: "100%", background: "none", border: 0, padding: 0, textAlign: "left" }} onClick={() => setHistoryOpen(true)}>
            <span className="glyph coral"><Timer size={24} /></span>
            <div style={{ flex: 1 }}>
              <div className="card-title">Timer kontraksi</div>
              <div className="card-sub">Ketuk saat mulai & saat selesai</div>
            </div>
            <ChevronRight size={20} className="faint" />
          </button>
          <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1fr 1fr", margin: "18px 0" }}>
            <div><div className="stat">{st.count}×</div><div className="stat-label">hari ini</div></div>
            <div className="vsep"><div className="stat">{st.avgDur ? durationLabel(st.avgDur) : "–"}</div><div className="stat-label">rata-rata durasi</div></div>
            <div className="vsep"><div className="stat">{st.avgGap ? durationLabel(st.avgGap) : "–"}</div><div className="stat-label">rata-rata jarak</div></div>
          </div>
          <button className={`btn lg block ${running ? "btn-coral" : "btn-ink"}`} onClick={toggleContraction}>
            {running ? <Square size={18} fill="currentColor" /> : <Play size={20} style={{ marginLeft: 2 }} />}
            {running ? <span className="num">Selesai · {durationLabel(now - running.at)}</span> : "Mulai kontraksi"}
          </button>
        </section>

        <section className="card">
          <div className="row">
            <span className="glyph mint"><Hand size={24} /></span>
            <div style={{ flex: 1 }}>
              <div className="card-title">Hitung gerakan</div>
              <div className="card-sub">
                {kickActive ? `Sesi berjalan · mulai ${timeLabel(kick.at)}` : kick ? `Sesi terakhir ${timeLabel(kick.at)} · ${kick.count} gerakan` : "Ketuk setiap terasa gerakan"}
              </div>
            </div>
            <div className="stat num">{kickActive ? kick.count : 0}<small> / 10</small></div>
          </div>
          <div className="segments" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => <i key={i} className={kickActive && i < kick.count ? "on" : ""} />)}
          </div>
          <button className="btn btn-soft block" style={{ marginTop: 16 }} onClick={addKick}>
            {kickActive ? <><Plus size={18} /> Gerakan</> : "Mulai sesi"}
          </button>
        </section>

        <section className="card">
          <div className="row">
            <span className="glyph lilac"><NotebookPen size={22} /></span>
            <div style={{ flex: 1 }}>
              <div className="card-title">Gejala hari ini</div>
              <div className="card-sub">
                {symToday.length ? `${symToday.length} dicatat · terakhir ${timeLabel(symToday[0].at)}` : "Belum ada catatan"}
              </div>
            </div>
            <button className="btn btn-soft sm" onClick={() => setSymOpen(true)}><Plus size={18} /> Catat</button>
          </div>
          {symToday.length > 0 && (
            <div className="chips" style={{ marginTop: 14 }}>
              {symToday.map((r) => (
                <button key={r.id} className="chip" onClick={() => { remove("symptoms", r.id); toast("Gejala dihapus"); }} aria-label={`Hapus ${r.name}`}>
                  <span className="dot" />{r.name}
                </button>
              ))}
            </div>
          )}
        </section>

        <a className="card" href="#/laporan">
          <div className="row">
            <span className="glyph coral"><FileText size={22} /></span>
            <div style={{ flex: 1 }}>
              <div className="card-title">Laporan untuk kontrol</div>
              <div className="card-sub">PDF untuk bidan · 1× gratis per bulan</div>
            </div>
            <ChevronRight size={20} className="faint" />
          </div>
        </a>
      </div>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen} title="Kontraksi hari ini">
        {today.length === 0 ? (
          <div className="empty"><strong>Belum ada kontraksi</strong>Tekan Mulai kontraksi saat terasa, lalu tekan lagi saat selesai.</div>
        ) : (
          <div className="list">
            {today.map((c, i) => (
              <div key={c.id} className="list-row">
                <div className="grow">
                  <div className="title num">{timeLabel(c.at)}</div>
                  <div className="sub num">
                    {c.end ? `Durasi ${durationLabel(c.end - c.at)}` : "Sedang berjalan"}
                    {today[i + 1] ? ` · jarak ${durationLabel(c.at - today[i + 1].at)}` : ""}
                  </div>
                </div>
                <button className="icon-btn" aria-label="Hapus" onClick={() => remove("contractions", c.id)}><Trash2 size={18} /></button>
              </div>
            ))}
          </div>
        )}
      </Sheet>

      <SymptomSheet open={symOpen} onOpenChange={setSymOpen} />
    </>
  );
}

function SymptomSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  useEffect(() => { if (open) { setPicked([]); setNote(""); } }, [open]);
  const toggle = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  function save() {
    const at = Date.now();
    picked.forEach((name) => put("symptoms", { at, name, note: note.trim() || undefined }));
    onOpenChange(false);
    toast(`${picked.length} gejala dicatat`);
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Catat gejala">
      <p className="muted" style={{ marginBottom: 16 }}>Pilih yang kamu rasakan sekarang.</p>
      <div className="chips">
        {SYMPTOMS.map((s) => (
          <button key={s} className="chip" aria-pressed={picked.includes(s)} onClick={() => toggle(s)}>{s}</button>
        ))}
      </div>
      <label className="field" style={{ marginTop: 18 }}>
        <span>Catatan (opsional)</span>
        <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Misal: setelah jalan pagi" />
      </label>
      <button className="btn btn-ink lg block" style={{ marginTop: 18 }} disabled={!picked.length} onClick={save}>Simpan</button>
    </Sheet>
  );
}

/* ---------------- Newborn (thin) ---------------- */

type Kind = "bottle" | "breast" | "pump" | "diaper";
const KINDS: { kind: Kind; label: string; glyph: string; Icon: typeof Milk }[] = [
  { kind: "bottle", label: "Botol", glyph: "mint", Icon: Milk },
  { kind: "breast", label: "ASI", glyph: "peach", Icon: Baby },
  { kind: "pump", label: "Pompa", glyph: "blue", Icon: Droplet },
  { kind: "diaper", label: "Popok", glyph: "coral", Icon: Square },
];

export function describe(kind: Kind, r: Rec) {
  if (kind === "bottle") return `Botol ${r.ml} ml · ${r.milk === "formula" ? "Formula" : "ASI perah"}`;
  if (kind === "breast") return `ASI ${SIDE_LABEL[r.side] ?? ""}${r.minutes ? ` · ${r.minutes} mnt` : ""}`;
  if (kind === "pump") return `Pompa ${r.ml} ml`;
  return `Popok · ${DIAPER_LABEL[r.type] ?? ""}`;
}

function NewbornLog() {
  const [open, setOpen] = useState<Kind | null>(null);
  const entries = KINDS.flatMap(({ kind }) => list(kind).map((r) => ({ kind, r })))
    .sort((a, b) => b.r.at - a.r.at)
    .slice(0, 30);
  return (
    <>
      <Header title="Log Bayi" />
      <div className="stack">
        <div className="grid2">
          {KINDS.map(({ kind, label, glyph, Icon }) => (
            <button key={kind} className="card" onClick={() => setOpen(kind)} style={{ transition: "scale 150ms ease-out" }}>
              <span className={`glyph ${glyph}`}><Icon size={22} /></span>
              <div className="card-title" style={{ marginTop: 12 }}>{label}</div>
              <div className="card-sub num">{list(kind).filter((r) => isToday(r.at)).length}× hari ini</div>
            </button>
          ))}
        </div>

        <section className="card">
          <div className="label">Catatan terbaru</div>
          {entries.length === 0 ? (
            <div className="empty"><strong>Belum ada catatan</strong>Ketuk Botol, ASI, Pompa, atau Popok di atas untuk mulai.</div>
          ) : (
            <div className="list" style={{ marginTop: 4 }}>
              {entries.map(({ kind, r }) => (
                <div key={r.id} className="list-row">
                  <div className="grow">
                    <div className="title">{describe(kind, r)}</div>
                    <div className="sub num">{isToday(r.at) ? "Hari ini" : new Date(r.at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} · {timeLabel(r.at)}</div>
                  </div>
                  <button className="icon-btn" aria-label="Hapus" onClick={() => remove(kind, r.id)}><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
          )}
          <p className="faint" style={{ fontSize: 13, marginTop: 12 }}>Riwayat ASI, pompa, dan popok: 30 hari terakhir. Botol: semua.</p>
        </section>
      </div>
      <NewbornSheet kind={open} onClose={() => setOpen(null)} />
    </>
  );
}

function NewbornSheet({ kind, onClose }: { kind: Kind | null; onClose: () => void }) {
  const [last, setLast] = useState<Kind>("bottle");
  const k = kind ?? last;
  useEffect(() => { if (kind) setLast(kind); }, [kind]);
  const [ml, setMl] = useState(90);
  const [milk, setMilk] = useState("formula");
  const [side, setSide] = useState("left");
  const [minutes, setMinutes] = useState(15);
  const [type, setType] = useState("pee");
  const title = { bottle: "Catat botol", breast: "Catat ASI", pump: "Catat pompa", diaper: "Catat popok" }[k];

  function save() {
    const at = Date.now();
    if (k === "bottle") put("bottle", { at, ml, milk });
    if (k === "breast") put("breast", { at, side, minutes });
    if (k === "pump") put("pump", { at, ml });
    if (k === "diaper") put("diaper", { at, type });
    onClose();
    toast("Tersimpan");
  }

  const Seg = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) => (
    <div className="segmented">
      {options.map(([v, l]) => <button key={v} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );

  return (
    <Sheet open={!!kind} onOpenChange={(o) => !o && onClose()} title={title}>
      <div className="stack" style={{ marginTop: 12 }}>
        {(k === "bottle" || k === "pump") && (
          <>
            <label className="field">
              <span>Jumlah (ml)</span>
              <input className="input num" type="number" inputMode="numeric" min={0} max={500} value={ml} onChange={(e) => setMl(Number(e.target.value))} />
            </label>
            <div className="chips">
              {[30, 60, 90, 120, 150].map((v) => <button key={v} className="chip num" aria-pressed={ml === v} onClick={() => setMl(v)}>{v} ml</button>)}
            </div>
          </>
        )}
        {k === "bottle" && <Seg value={milk} onChange={setMilk} options={[["formula", "Formula"], ["expressed", "ASI perah"]]} />}
        {k === "breast" && (
          <>
            <Seg value={side} onChange={setSide} options={[["left", "Kiri"], ["right", "Kanan"], ["both", "Keduanya"]]} />
            <label className="field">
              <span>Durasi (menit)</span>
              <input className="input num" type="number" inputMode="numeric" min={0} max={120} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
            </label>
          </>
        )}
        {k === "diaper" && <Seg value={type} onChange={setType} options={[["pee", "Pipis"], ["poo", "Pup"], ["both", "Keduanya"]]} />}
        <button className="btn btn-ink lg block" onClick={save} disabled={(k === "bottle" || k === "pump") && !(ml > 0)}>Simpan</button>
      </div>
    </Sheet>
  );
}
