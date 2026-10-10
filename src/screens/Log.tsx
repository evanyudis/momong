import Segmented from "../Segmented";
import DayView from "./NewbornDayView";
import { kinds as KINDS, type Kind } from "../newborn";
import { useRoute } from "../route";
import { durationMinutes, feedingDetails, localDateTime, normalizePumpTags } from "../feeding";
import { PLUS_ENABLED } from "../release";
import { Baby, Check, ChevronRight, Droplet, Filter, FileText, Hand, Hospital, Milk, NotebookPen, Pencil, Play, Plus, RotateCcw, Square, Timer, Trash2, TriangleAlert, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { DIAPER_LABEL, type PlusVariant, SIDE_LABEL, SYMPTOMS } from "../content";
import { alertVisible, analyzePattern, clock, distanceTier, durLabel, finished, gapLabel, intervalFor } from "../contractions";
import { durationLabel, isToday, pregnancy, timeLabel } from "../dates";
import { animate, reducedMotion } from "../motion";
import { isPlus, getPrefs, hasHidden, list, put, remove, type Rec, setPrefs, settings, useDB } from "../store";
import { DateInput, DeleteButton, Header, PlusSheet, Sheet, toast } from "../ui";

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
  // Last saved duration shown on the clock until "Reset". Display only; never touches data.
  const [saved, setSaved] = useState<number | null>(null);
  const segRef = useRef<HTMLDivElement>(null);
  const changedKick = useRef(false);
  const kick = list("kicks")[0];
  const kickActive = kick && !kick.done;
  useLayoutEffect(() => {
    if (!changedKick.current) return;
    changedKick.current = false;
    return animate(segRef.current?.children[(kick?.count ?? 1) - 1] ?? null, [{ opacity: .4, transform: "scaleX(.6)" }, { opacity: 1, transform: "none" }], 150);
  }, [kick?.count, kick?.id]);
  const [symOpen, setSymOpen] = useState(false);
  const symToday = list("symptoms").filter((r) => isToday(r.at));

  function toggleContraction() {
    try {
    if (running) {
      const end = Date.now();
      // Start-to-start, like v1: this start minus the previous finished start.
      put("contractions", { id: running.id, end, interval: intervalFor(running.at, contractions) });
      setSaved(end - running.at);
      toast(`Kontraksi ${durLabel(end - running.at)} tersimpan`);
    } else {
      setSaved(null);
      put("contractions", { at: Date.now() });
    }
    } catch { toast("Kontraksi belum tersimpan. Coba simpan lagi.", "error"); }
  }

  function addKick() {
    try {
    changedKick.current = true;
    if (!kickActive) {
      put("kicks", { at: Date.now(), count: 1, last: Date.now() });
      return;
    }
    const count = kick.count + 1;
    const done = count >= 10;
    put("kicks", { id: kick.id, count, last: Date.now(), done });
    if (done) toast(`10 gerakan bayi tercatat dalam ${durationLabel(Date.now() - kick.at)}`);
    } catch { changedKick.current = false; toast("Gerakan bayi belum tersimpan. Coba catat lagi.", "error"); }
  }

  return (
    <>
      <Header title="Log Kehamilan" aside={<span className="pill" style={{ boxShadow: "var(--elevation-raised)", background: "transparent" }}>Minggu ke-{p.week}</span>} />
      <div className="stack">
        <PatternAlert />
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
          <div className="spread timer-clock">
            <div>
              <div className="num clock">{clock(running ? now - running.at : saved ?? 0)}</div>
              <div className="stat-label">{running ? "Sedang berjalan" : saved != null ? "Tersimpan" : "Timer"}</div>
            </div>
            {!running && saved != null && (
              <button className="btn btn-soft sm" onClick={() => setSaved(null)}>
                <RotateCcw size={16} /> Reset
              </button>
            )}
          </div>
          <button className={`btn lg block ${running ? "btn-coral" : "btn-ink"}`} onClick={toggleContraction}>
            {running ? <Square size={18} fill="currentColor" /> : <Play size={20} style={{ marginLeft: 2 }} />}
            {running ? <span className="num">Selesai · {durLabel(now - running.at)}</span> : "Mulai kontraksi"}
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
            <div className="stat num">{kick?.count ?? 0}<small> / 10</small></div>
          </div>
          <div ref={segRef} className="segments" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => <i key={i} className={kick && i < kick.count ? "on" : ""} />)}
          </div>
          <button className="btn btn-soft block" style={{ marginTop: 16 }} onClick={addKick}>
            {kickActive ? <><Plus size={18} /> Gerakan</> : kick?.done ? "Mulai sesi baru" : "Mulai sesi"}
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
                <DeleteButton key={r.id} className="chip" label={r.name} onDelete={() => remove("symptoms", r.id)}>
                  <span className="dot" />{r.name}
                </DeleteButton>
              ))}
            </div>
          )}
        </section>

        <ReportCard />
      </div>

      <ContractionHistory open={historyOpen} onOpenChange={setHistoryOpen} />

      <SymptomSheet open={symOpen} onOpenChange={setSymOpen} />
    </>
  );
}

function ReportCard() {
  return (
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
  );
}

const dayTime = (t: number) =>
  isToday(t) ? timeLabel(t) : `${new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} · ${timeLabel(t)}`;

function ContractionHistory({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => { if (!open) setConfirming(false); }, [open]);
  const confirmRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (confirming) confirmRef.current?.scrollIntoView({ block: "nearest" }); }, [confirming]);
  const all = list("contractions");
  const running = all.find((c) => !c.end);
  const rows = finished(all).reverse();

  function deleteAll() {
    // Contractions only. Kicks and symptoms stay.
    list("contractions").forEach((c) => remove("contractions", c.id));
    setConfirming(false);
    toast("Riwayat kontraksi dihapus");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Riwayat kontraksi">
      {rows.length === 0 && !running ? (
        <div className="empty"><strong>Belum ada kontraksi</strong>Tekan Mulai kontraksi saat terasa, lalu tekan lagi saat selesai.</div>
      ) : (
        <>
          <div className="list">
            {running && (
              <div className="list-row">
                <div className="grow">
                  <div className="title num">{dayTime(running.at)}</div>
                  <div className="sub">Sedang berjalan</div>
                </div>
                <DeleteButton label={`Kontraksi ${timeLabel(running.at)}`} onDelete={() => remove("contractions", running.id)} />
              </div>
            )}
            {rows.map((c) => {
              const tier = distanceTier(c.interval);
              return (
                <div key={c.id} className="list-row">
                  <div className="grow">
                    <div className="title num">{dayTime(c.at)}</div>
                    <div className="sub num">Durasi {durLabel(c.end - c.at)}</div>
                  </div>
                  {tier ? (
                    <span className="badge num" data-tier={tier} aria-label={`Jarak ${gapLabel(c.interval!)}`}>
                      <span className="dot" />{gapLabel(c.interval!)}
                    </span>
                  ) : (
                    <span className="faint" style={{ fontSize: 13 }}>Kontraksi pertama</span>
                  )}
                  <DeleteButton label={`Kontraksi ${timeLabel(c.at)}`} onDelete={() => remove("contractions", c.id)} />
                </div>
              );
            })}
          </div>
          <div className="legend" aria-hidden="true">
            <span><span className="dot" data-tier="danger" />&lt; 4m</span>
            <span><span className="dot" data-tier="warning" />4–5m</span>
            <span><span className="dot" data-tier="calm" />≥ 5m</span>
            <span className="faint">jarak mulai ke mulai</span>
          </div>
          {confirming ? (
            <div ref={confirmRef} className="confirm" role="alertdialog" aria-label="Hapus semua riwayat kontraksi?">
              <p style={{ fontWeight: 600 }}>Hapus semua riwayat kontraksi?</p>
              <p className="muted" style={{ fontSize: 14, marginTop: 2 }}>Catatan gerakan dan gejala tidak ikut terhapus.</p>
              <div className="grid2" style={{ marginTop: 14 }}>
                <button className="btn btn-ghost" onClick={() => setConfirming(false)} autoFocus>Batal</button>
                <button className="btn btn-danger-solid" onClick={deleteAll}>Ya, hapus semua</button>
              </div>
            </div>
          ) : (
            <button className="btn btn-soft block" style={{ marginTop: 16 }} onClick={() => setConfirming(true)}>
              <Trash2 size={18} /> Hapus semua
            </button>
          )}
        </>
      )}
    </Sheet>
  );
}

/** 10-minute pattern alert (v1 parity). Renders nothing when there is no pattern; never an empty card. */
export function PatternAlert() {
  useDB();
  const [now, setNow] = useState(Date.now());
  const [leaving, setLeaving] = useState(false);
  // The window slides with time, so re-check while the screen is open.
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);
  const p = analyzePattern(list("contractions"), now);
  if (!p || !alertVisible(p, getPrefs(), now)) return null;
  const critical = p.level === "critical";
  return (
    <section className="alert card" data-level={p.level} data-leaving={leaving || undefined} role={critical ? "alert" : "status"}>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <span className="alert-icon">{critical ? <Hospital size={20} /> : <TriangleAlert size={20} />}</span>
        <div style={{ flex: 1 }}>
          <div className="card-title">{critical ? "Waktunya ke RS!" : "Perhatian"}</div>
          <p className="muted" style={{ fontSize: 15, marginTop: 4, lineHeight: 1.45 }}>
            {critical
              ? "Kontraksi sudah teratur dan kuat. Segera hubungi dokter atau pergi ke rumah sakit."
              : "Kontraksi mulai sering. Terus pantau dan siapkan diri untuk ke RS."}
          </p>
        </div>
        <button
          className="alert-close" aria-label="Tutup"
          onClick={() => {
            // Quiet exit (fade + small lift), then dismiss.
            setLeaving(true);
            setTimeout(() => {
              setPrefs(critical ? { criticalDismissedAt: Date.now() } : { warningDismissedFor: p.ids });
              setLeaving(false);
            }, reducedMotion() ? 0 : 150);
          }}
        >
          <X size={18} />
        </button>
      </div>
      <div className="alert-stats">
        <div><div className="stat num">{p.count}×</div><div className="stat-label">10 menit terakhir</div></div>
        <div className="vsep"><div className="stat num">{gapLabel(p.avgGap)}</div><div className="stat-label">rata-rata jarak</div></div>
        <div className="vsep"><div className="stat num">{durLabel(p.avgDur)}</div><div className="stat-label">rata-rata durasi</div></div>
      </div>
    </section>
  );
}

function SymptomSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const savedNames = useRef(new Set<string>());
  const saving = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setPicked([]); setNote(""); setError(""); savedNames.current.clear(); saving.current = false; } }, [open]);
  const toggle = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  function save() {
    if (saving.current) return;
    saving.current = true;
    try {
      const at = Date.now();
      for (const name of picked) {
        if (savedNames.current.has(name)) continue;
        put("symptoms", { at, name, note: note.trim() || undefined });
        savedNames.current.add(name);
      }
      onOpenChange(false);
      toast(`${picked.length} gejala tersimpan`);
    } catch { saving.current = false; setError("Catatan belum lengkap tersimpan. Coba simpan lagi."); }
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Catat gejala">
      {error && <p role="alert">{error}</p>}
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

export function describe(kind: Kind, r: Rec) {
  if (kind === "bottle") return `Minum susu ${r.ml} ml · ${r.milk === "formula" ? "Formula" : "ASI perah"}${r.offeredMl != null ? ` · ditawarkan ${r.offeredMl} ml, sisa ${r.remainingMl} ml` : ""}`;
  if (kind === "breast") return `Menyusu langsung ${r.side === "both" ? "Bergantian" : SIDE_LABEL[r.side] ?? ""}${r.minutes ? ` · ${durationLabel(r.minutes * 60000)}` : ""}`;
  if (kind === "pump") return `Pumping${r.side ? ` ${SIDE_LABEL[r.side] ?? ""}` : ""}${r.ml != null ? ` · ${r.ml} ml` : " · tanpa volume"}${r.tags?.length ? ` · ${r.tags.join(", ")}` : ""}`;
  return `Ganti popok · ${DIAPER_LABEL[r.type] ?? ""}`;
}

function NewbornLog() {
  const { params } = useRoute();
  const [open, setOpen] = useState<Kind | null>(null);
  const [editing, setEditing] = useState<Rec | null>(null);
  const [plus, setPlus] = useState<PlusVariant | null>(null);
  const [selected, select] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const now = useNow(true);
  useEffect(() => { if (params.get("day") === "today") { select(null); setFilter("all"); } }, [params]);
  const entries = KINDS.flatMap(({kind}) => list(kind).map(r => ({...r, at:r.at as number, kind})));
  return <><Header title="Log bayi" /><div className="stack">
    <DayView entries={entries} now={now} selected={selected} select={select} filter={filter} setFilter={setFilter}
      edit={e => { setEditing(list(e.kind).find(r => r.id === e.id)!); setOpen(e.kind); }}
      add={() => document.querySelector<HTMLButtonElement>(".add-log")?.click()} />
    <p className="card-sub">{isPlus() ? "Semua riwayat tersimpan · Plus" : "Riwayat menyusu langsung, pumping, dan popok tersedia selama 30 hari. Minum susu tersedia seluruhnya."}</p>
    {hasHidden() && <button className="chip plus-entry" disabled={!PLUS_ENABLED} onClick={() => setPlus("insights")}>{PLUS_ENABLED ? "Buka riwayat lengkap di Plus" : "Segera hadir"}</button>}
    <ReportCard />
  </div><NewbornSheet record={editing} kind={open} onClose={() => setOpen(null)} /><PlusSheet variant={plus} onClose={() => setPlus(null)} /></>;
}

type BreastDraft = { at: number; end?: number; side: string };
const DRAFT_KEY = "bb_breast_timer_v1";
function readBreastDraft(): BreastDraft | null {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
    return d && Number.isFinite(d.at) && d.at <= Date.now() && ["left", "right", "both"].includes(d.side) &&
      (d.end === undefined || Number.isFinite(d.end) && d.end >= d.at) ? d : null;
  } catch { return null; }
}

function BreastClock({ at }: { at: number }) {
  const now = useNow(true);
  return <div className="num clock" role="timer" aria-label="Durasi menyusu">{clock(Math.max(0, now - at))}</div>;
}

export function NewbornSheet({ kind, record, onClose }: { kind: Kind | null; record: Rec | null; onClose: () => void }) {
  const [last, setLast] = useState<Kind>("bottle");
  const k = kind ?? last;
  const [ml, setMl] = useState("");
  const [remaining, setRemaining] = useState("0");
  const [milk, setMilk] = useState("formula");
  const [side, setSide] = useState("");
  const [minutes, setMinutes] = useState("");
  const [type, setType] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [emptyPump, setEmptyPump] = useState(false);
  const [at, setAt] = useState("");
  const [draft, setDraft] = useState<BreastDraft | null>(null);
  const running = !!draft && draft.end === undefined;
  const saved = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!kind) return;
    setLast(kind);
    const d = kind === "breast" && !record ? readBreastDraft() : null;
    setDraft(d);
    setMl(String(record?.offeredMl ?? record?.ml ?? ""));
    setEmptyPump(!!record && record.ml == null);
    setRemaining(String(record?.remainingMl ?? 0));
    setMilk(record?.milk ?? "formula");
    setSide(d?.side ?? record?.side ?? "");
    setMinutes(d?.end !== undefined ? clock(d.end - d.at) : record?.minutes != null ? clock(record.minutes * 60000) : "");
    setType(record?.type ?? "");
    setTags(record?.tags ?? []);
    setTagInput("");
    setAddingTag(false);
    setAt(localDateTime(d?.at ?? record?.at ?? Date.now()));
    saved.current = false;
    setError("");
  }, [kind, record]);

  function changeTimer(next: BreastDraft | null) {
    try {
      if (next) localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      else localStorage.removeItem(DRAFT_KEY);
      setDraft(next);
      setError("");
      if (next && next.at !== draft?.at) setAt(localDateTime(next.at));
      if (next?.end !== undefined && next.end !== draft?.end) setMinutes(clock(next.end - next.at));
    } catch { setError("Timer belum tersimpan. Coba lagi sebelum menutup."); }
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (saved.current || !kind || !canSave) return;
    try {
      const details = feedingDetails(k, { at: draft && at === localDateTime(draft.at) ? draft.at : record && at === localDateTime(record.at) ? record.at : new Date(at).getTime(), ml, remaining, milk, side, minutes: k === "breast" ? durationMinutes(minutes) : minutes, type });
      saved.current = true;
      const pumpTags = k === "pump" ? normalizePumpTags([...tags, ...(tagInput.trim() ? [tagInput] : [])]) : undefined;
      const result = put(k, { ...(k === "pump" && record?.minutes != null ? { minutes: record.minutes } : {}), ...details, ...(pumpTags ? { tags: pumpTags } : {}), ...(record ? { id: record.id } : {}) });
      if (draft) {
        // The log is already durable; a failed draft cleanup must not cause a duplicate save.
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* keep the saved log */ }
        setDraft(null);
      }

      onClose();
      toast(`${describe(k, result)} ${record ? "diperbarui" : "tersimpan"}`);
    } catch (e) { saved.current = false; setError(e instanceof Error && !(e instanceof DOMException) ? e.message : "Catatan belum tersimpan. Coba simpan lagi."); }
  }


  const tagOptions = [...new Set(["Power pumping", ...list("pump").flatMap(r => r.tags ?? []), ...tags])];
  function addTag() {
    if (!tagInput.trim()) return;
    try { setTags(normalizePumpTags([...tags, tagInput])); setTagInput(""); setAddingTag(false); setError(""); }
    catch (e) { setError((e as Error).message); }
  }

  let canSave = !running && (k !== "pump" || ml !== "" || emptyPump);
  try {
    const details = feedingDetails(k, { at: new Date(at).getTime(), ml, remaining, milk, side, minutes: k === "breast" ? durationMinutes(minutes) : minutes, type });
    if (k === "breast" && !(details.minutes! > 0)) canSave = false;
    if (k === "pump") normalizePumpTags([...tags, ...(tagInput.trim() ? [tagInput] : [])]);
  } catch { canSave = false; }

  const title = { bottle: "minum susu", breast: "menyusu langsung", pump: "pumping", diaper: "ganti popok" }[k];
  return (
    <Sheet open={!!kind} onOpenChange={(o) => !o && onClose()} title={`${record ? "Edit" : "Catat"} ${title}`}>
      <form className="stack" style={{ marginTop: 12 }} onSubmit={save}>
        {(k === "bottle" || k === "pump") && <>
          <label className="field">
            <span>{k === "bottle" ? "Jumlah ditawarkan (ml)" : "Hasil pumping (ml, opsional)"}</span>
            <input className="input num" type="number" inputMode="decimal" min={0} max={500} step="any" required={k === "bottle"} value={ml} onChange={(e) => { setMl(e.target.value); setEmptyPump(false); }} />
          </label>
          <div className="chips">
            {[30, 60, 90, 120, 150].map((v) => <button key={v} type="button" className="chip num" aria-pressed={ml === String(v)} onClick={() => { setMl(String(v)); setEmptyPump(false); }}>{v} ml</button>)}
          </div>
        </>}
        {k === "bottle" && <>
          <label className="field"><span>Sisa susu (ml)</span><input className="input num" type="number" inputMode="decimal" required min={0} max={Number(ml) || 0} step="any" value={remaining} onChange={(e) => setRemaining(e.target.value)} /></label>
          <p className="card-sub num" aria-live="polite">Diminum: {ml !== "" && remaining !== "" && Number(remaining) <= Number(ml) ? `${Math.round((Number(ml) - Number(remaining)) * 1000) / 1000} ml` : "–"}</p>
          <Segmented label="Jenis susu" value={milk} onChange={setMilk} options={[["formula", "Formula"], ["expressed", "ASI perah"]]} />
        </>}
        {(k === "breast" || k === "pump") && <>
          <Segmented label="Sisi payudara" value={side} onChange={(v) => {
            if (draft) changeTimer({ ...draft, side: v });
            setSide(v);
          }} options={[["left", "Kiri"], ["right", "Kanan"], ["both", k === "breast" ? "Bergantian" : "Keduanya"]]} />
          {k === "pump" && <label className="pump-empty"><input type="checkbox" checked={emptyPump} onChange={e => { setEmptyPump(e.target.checked); if (e.target.checked) setMl(""); }} /><span>Catat pengosongan tanpa volume</span></label>}
        </>}
        {k === "breast" && <>
          {!record && <div className="card stack">
            {running ? <>
              <BreastClock at={draft!.at} />
              <p className="card-sub">Timer tetap berjalan saat catatan ditutup.</p>
              <button type="button" className="btn btn-soft block" onClick={() => changeTimer({ ...draft!, end: Date.now() })}><Square size={18} /> Hentikan timer</button>
            </> : <button type="button" className="btn btn-soft block" disabled={!side} onClick={() => changeTimer({ at: Date.now(), side })}><Play size={18} /> {draft ? "Mulai ulang timer" : "Mulai timer"}</button>}
            {draft && <button type="button" className="btn btn-ghost block" onClick={() => { changeTimer(null); setMinutes(""); setAt(localDateTime(Date.now())); }}>Batalkan timer</button>}
          </div>}
          <label className="field"><span>Durasi (menit:detik)</span><input className="input num" type="text" inputMode="text" required pattern="[0-9]{1,4}:[0-5][0-9]" placeholder="05:30" aria-describedby="dbf-duration-hint" disabled={running} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label><p id="dbf-duration-hint" className="card-sub">{running ? "Hentikan timer untuk mengubah durasi." : "Contoh 05:30 = 5 menit 30 detik. Bisa diisi manual atau dari timer."}</p>
        </>}
        <label className="field"><span>{k === "breast" || k === "pump" ? "Waktu mulai sesi" : "Waktu catatan"}</span><DateInput className="num" type="datetime-local" required disabled={running} max={localDateTime(Date.now())} value={at} onChange={(e) => setAt(e.target.value)} /></label>
        {k === "pump" && <div className="pump-tags">
          <div className="label">Tag <span className="faint">(opsional)</span></div>
          <div className="chips" role="group" aria-label="Pilih tag pumping">
            {tagOptions.map(tag => <button type="button" className="chip" key={tag} aria-pressed={tags.includes(tag)} onClick={() => {
              try { setTags(normalizePumpTags(tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag])); setError(""); }
              catch (e) { setError((e as Error).message); }
            }}>{tag}</button>)}
            {!addingTag && <button type="button" className="chip" onClick={() => setAddingTag(true)}><Plus size={14} /> Tag baru</button>}
          </div>
          {addingTag && <div className="pump-tag-entry">
            <input className="input" aria-label="Tag baru" autoFocus value={tagInput} maxLength={40} placeholder="Nama tag" onChange={e => setTagInput(e.target.value)} onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); addTag(); }
              if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setAddingTag(false); setTagInput(""); }
            }} />
            <button type="button" className="icon-btn" aria-label="Tambahkan tag" disabled={!tagInput.trim()} onClick={addTag}><Plus size={18} /></button>
            <button type="button" className="icon-btn" aria-label="Batal tambah tag" onClick={() => { setAddingTag(false); setTagInput(""); }}><X size={18} /></button>
          </div>}
        </div>}
        {k === "diaper" && <Segmented label="Jenis popok" value={type} onChange={setType} options={[["pee", "Pipis"], ["poo", "Pup"], ["both", "Keduanya"]]} />}
        {error && <p className="restore-error" role="alert"><TriangleAlert size={18} />{error}</p>}
        <button type="submit" className="btn btn-ink lg block" disabled={!canSave}>{record ? "Simpan perubahan" : "Simpan catatan"}</button>
      </form>
      {record && <DeleteButton className="btn btn-ghost block" label={describe(k, record)} onDelete={() => { remove(k, record.id); onClose(); }}>Hapus catatan</DeleteButton>}
    </Sheet>
  );
}
