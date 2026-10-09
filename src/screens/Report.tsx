import { PLUS_ENABLED } from "../release";
import { useRef, useState } from "react";
import { type PlusVariant } from "../content";
import { todayISO } from "../dates";
import { buildReport, type ReportTable } from "../report";
import { activeBabyId, babyProfiles, setPrefs, isPlus, get, getPrefs, list, put, settings, useDB } from "../store";
import { toast, PlusSheet, TopBar } from "../ui";

const monthKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}`;

/** Free PDF quota is shared through the household settings record. */
export function Report() {
  useDB();
  const s = settings();
  const [range, setRange] = useState<"7" | "14" | "30" | "all">("14");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const usedThisMonth = !isPlus() && get("settings", "report")?.month === monthKey();
  const [plus, setPlus] = useState<PlusVariant | null>(null);
  const report = buildReport({ settings: s, name: getPrefs().name || "", range: isPlus() ? range : "14", now: Date.now(), records: Object.fromEntries((["bottle", "breast", "pump", "diaper", "contractions", "kicks", "symptoms"] as const).map(kind => [kind, list(kind)])) });

  const maxBottleMl = Math.max(1, ...report.chart.map(day => day.ml ?? 0));

  async function download() {
    if (lock.current || usedThisMonth) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const { downloadReportPDF } = await import("../pdf");
      await downloadReportPDF(report, `momong-${todayISO()}.pdf`);
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
        {isPlus() && <label className="field no-print"><span>Periode laporan</span><select className="input" disabled={busy} value={range} onChange={(e) => setRange(e.target.value as typeof range)}><option value="7">7 hari</option><option value="14">14 hari</option><option value="30">30 hari</option><option value="all">Semua catatan</option></select></label>}
        <section className="card solid stack">
          <h2 className="card-title">{report.title}</h2>
          <p className="card-sub">{report.period}</p>
          {report.context.map(line => <p key={line}>{line}</p>)}
          <p className="faint">Dibuat {report.generated}</p>
        </section>
        <section className="card solid stack">
          <h2 className="card-title">Cakupan pencatatan</h2><p>{report.coverage}</p>
          <h2 className="card-title">Ringkasan periode</h2>
          {report.summary.map(line => <p key={line}>{line}</p>)}
        </section>
        <section className="card solid stack"><h2 className="card-title">Cara membaca laporan</h2>{report.notes.map(line => <p className="muted" key={line}>{line}</p>)}</section>
        {report.chart.some(day => day.ml !== null) && <section className="card solid stack">
          <h2 className="card-title">Susu botol yang diminum per hari</h2>
          <p className="muted">Volume tercatat (ml). Tanda - berarti tidak ada volume tercatat, bukan nol konsumsi.</p>
          <div className="report-chart">{report.chart.map(day => <div className="report-chart-row" key={day.date}><span>{day.date}</span><div>{day.ml !== null && <span style={{ width: `${day.ml / maxBottleMl * 100}%` }} />}</div><span className="num">{day.ml === null ? "-" : day.ml.toLocaleString("id-ID", { maximumFractionDigits: 1 })}</span></div>)}</div>
        </section>}
        {report.tables.map(table => <ReportTablePreview key={table.title} table={table} />)}
        <details className="card solid report-details"><summary>Lampiran catatan · {report.details.rows.length} catatan</summary>
          {report.details.rows.length > 80 && <p className="muted">Preview menampilkan 80 catatan pertama. PDF mencakup seluruh catatan dalam periode.</p>}
          <ReportTablePreview table={{ ...report.details, rows: report.details.rows.slice(0, 80) }} />
        </details>

        <div className="no-print stack" style={{ marginTop: 8 }}>
          {/* Free quota used: the button opens the Plus sheet instead of printing. The 1×/bulan rule itself is unchanged. */}
          <button
            className={`btn lg block ${usedThisMonth ? "btn-soft plus-entry" : "btn-ink"}`}
            aria-haspopup={PLUS_ENABLED && usedThisMonth ? "dialog" : undefined}
            disabled={busy || usedThisMonth && !PLUS_ENABLED}
            aria-busy={busy}
            onClick={usedThisMonth ? () => setPlus("pdf") : download}
          >
            {busy ? "Membuat PDF…" : usedThisMonth ? PLUS_ENABLED ? "PDF bulan ini sudah dibuat" : "Segera hadir" : "Unduh PDF"}
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

function ReportTablePreview({ table }: { table: ReportTable }) {
  return <section className="card solid stack report-table-section"><h2 className="card-title">{table.title}</h2>
    {!table.rows.length ? <p className="muted">Belum ada catatan dalam periode ini.</p> : <div className="report-table-scroll" role="region" aria-label={table.title} tabIndex={0}><table className="report-table"><thead><tr>{table.columns.map(col => <th scope="col" key={col}>{col}</th>)}</tr></thead><tbody>{table.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className={table.numeric?.includes(j) ? "num report-number" : ""}>{cell}</td>)}</tr>)}</tbody></table></div>}
  </section>;
}
