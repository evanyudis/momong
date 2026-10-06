import { useRef, useState } from "react";
import { type PlusVariant } from "../content";
import { dateLabel, durationLabel, pregnancy, timeLabel } from "../dates";
import { activeBabyId, babyProfiles, setPrefs, isPlus, get, getPrefs, list, put, settings, useDB } from "../store";
import { toast, PlusSheet, TopBar } from "../ui";
import { contractionStats, describe } from "./Log";

const DAY = 86_400_000;
const monthKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}`;

/** Free PDF quota is shared through the household settings record. */
export function Report() {
  useDB();
  const s = settings();
  const [range, setRange] = useState("14");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const since = isPlus() && range === "all" ? 0 : Date.now() - Number(isPlus() ? range : "14") * DAY;
  const usedThisMonth = !isPlus() && get("settings", "report")?.month === monthKey();
  const born = s.birthMode === "postpartum";
  const p = !born && s.hpl ? pregnancy(s.hpl) : null;
  const [plus, setPlus] = useState<PlusVariant | null>(null);


  const contractions = list("contractions").filter((c) => c.at >= since && c.end);
  const cs = contractionStats(contractions);
  const kicks = list("kicks").filter((k) => k.at >= since);
  const symptoms = list("symptoms").filter((x) => x.at >= since);
  const feeds = (["bottle", "breast", "pump", "diaper"] as const).flatMap((k) => list(k).filter((r) => r.at >= since).map((r) => ({ k, r })))
    .sort((a, b) => b.r.at - a.r.at);

  async function download() {
    if (lock.current || usedThisMonth) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const { downloadReportPDF } = await import("../pdf");
      const lines = [
        `Dibuat ${dateLabel(Date.now())}. Profil: ${s.babyName || "Si kecil"}.`,
        ...(p ? [`HPL ${dateLabel(s.hpl!)}. Minggu ke-${p.week}.`] : []),
        ...(born ? feeds.map(({ k, r }) => `${dateLabel(r.at)} ${timeLabel(r.at)} - ${describe(k, r)}`) : [
          "Kontraksi", ...contractions.map((r) => `${dateLabel(r.at)} ${timeLabel(r.at)} - ${durationLabel(r.end - r.at)}`),
          "Gerakan", ...kicks.map((r) => `${dateLabel(r.at)} ${timeLabel(r.at)} - ${r.count} gerakan`),
          "Gejala", ...symptoms.map((r) => `${dateLabel(r.at)} ${timeLabel(r.at)} - ${r.name}${r.note ? `: ${r.note}` : ""}`),
        ]),
      ];
      await downloadReportPDF(`Laporan ${isPlus() && range === "all" ? "semua catatan" : `${isPlus() ? range : "14"} hari`} - ${getPrefs().name || "Bunda"}`, lines, `momong-${new Date().toISOString().slice(0, 10)}.pdf`);
      if (!isPlus()) put("settings", { id: "report", month: monthKey() });
      toast("PDF siap diunduh");
    } catch { setError("PDF belum bisa dibuat. Coba lagi; kuota belum terpakai."); }
    finally { lock.current = false; setBusy(false); }
  }

  return (
    <>
      <div className="no-print"><TopBar title="Laporan" back="#/log" /></div>
      <div className="stack">
        <p className="muted">Profil: {s.babyName || "Si kecil"}. PDF dibuat di perangkat dan dapat diunduh saat offline.</p>
        {isPlus() && <label className="field no-print"><span>Profil laporan</span><select className="input" disabled={busy} value={activeBabyId()} onChange={(e) => setPrefs({ activeBabyId: e.target.value })}>{babyProfiles().map((baby) => <option key={baby.id} value={baby.id}>{baby.babyName || "Si kecil"}</option>)}</select></label>}
        {error && <p role="alert">{error}</p>}
        <section className="card solid">
          <div className="card-title">Laporan {isPlus() && range === "all" ? "semua catatan" : `${isPlus() ? range : "14"} hari`} · {getPrefs().name || "Bunda"}</div>
          <div className="card-sub">
            Dibuat {dateLabel(Date.now())}{p ? ` · HPL ${dateLabel(s.hpl!)} · minggu ke-${p.week}` : ""}
          </div>
        </section>

        {isPlus() && <label className="field no-print"><span>Periode laporan</span><select className="input" disabled={busy} value={range} onChange={(e) => setRange(e.target.value)}><option value="7">7 hari</option><option value="14">14 hari</option><option value="30">30 hari</option><option value="all">Semua catatan</option></select></label>}
        {!born && (
          <>
            <section className="card solid">
              <div className="label">Kontraksi</div>
              <p style={{ marginTop: 6 }} className="num">
                {cs.count}× tercatat · rata-rata durasi {cs.avgDur ? durationLabel(cs.avgDur) : "–"} · rata-rata jarak {cs.avgGap ? durationLabel(cs.avgGap) : "–"}
              </p>
            </section>
            <section className="card solid">
              <div className="label">Hitung gerakan</div>
              {kicks.length === 0 ? <p className="muted" style={{ marginTop: 6 }}>Belum ada sesi.</p> : kicks.map((k) => (
                <p key={k.id} className="num" style={{ marginTop: 6 }}>{dateLabel(k.at)} {timeLabel(k.at)} · {k.done ? `10 gerakan dalam ${durationLabel(k.last - k.at)}` : `${k.count} gerakan`}</p>
              ))}
            </section>
            <section className="card solid">
              <div className="label">Gejala</div>
              {symptoms.length === 0 ? <p className="muted" style={{ marginTop: 6 }}>Belum ada gejala.</p> : symptoms.map((x) => (
                <p key={x.id} className="num" style={{ marginTop: 6 }}>{dateLabel(x.at)} {timeLabel(x.at)} · {x.name}{x.note ? ` — ${x.note}` : ""}</p>
              ))}
            </section>
          </>
        )}

        {born && (
          <section className="card solid">
            <div className="label">Menyusu, pompa & popok</div>
            {feeds.length > 80 && <p className="muted">Preview menampilkan 80 catatan terbaru. PDF mencakup seluruh catatan dalam periode yang dipilih.</p>}
            {feeds.length === 0 ? <p className="muted" style={{ marginTop: 6 }}>Belum ada catatan.</p> : feeds.slice(0, 80).map(({ k, r }) => (
              <p key={r.id} className="num" style={{ marginTop: 6 }}>{dateLabel(r.at)} {timeLabel(r.at)} · {describe(k, r)}</p>
            ))}
          </section>
        )}

        <div className="no-print stack" style={{ marginTop: 8 }}>
          {/* Free quota used: the button opens the Plus sheet instead of printing. The 1×/bulan rule itself is unchanged. */}
          <button
            className={`btn lg block ${usedThisMonth ? "btn-soft" : "btn-ink"}`}
            aria-haspopup={usedThisMonth ? "dialog" : undefined}
            disabled={busy}
            aria-busy={busy}
            onClick={usedThisMonth ? () => setPlus("pdf") : download}
          >
            {busy ? "Membuat PDF…" : usedThisMonth ? "PDF bulan ini sudah dibuat" : "Unduh PDF"}
          </button>
          <p className="faint" style={{ fontSize: 14, textAlign: "center" }}>
            {usedThisMonth ? "Kuota gratis kembali awal bulan depan. Laporan tetap bisa dilihat di sini." : isPlus() ? "PDF tanpa batas · Plus" : "1× gratis per bulan. PDF dibuat di perangkat ini."}
          </p>
        </div>
      </div>
      <PlusSheet variant={plus} onClose={() => setPlus(null)} />
    </>
  );
}
