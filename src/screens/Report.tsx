import { DIAPER_LABEL } from "../content";
import { dateLabel, durationLabel, pregnancy, timeLabel } from "../dates";
import { get, getPrefs, list, put, settings, useDB } from "../store";
import { TopBar } from "../ui";
import { contractionStats, describe } from "./Log";

const DAY = 86_400_000;
const monthKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}`;

/** PRD Free: PDF 1× per month per household (synced, so both partners share it). Printed via "Save as PDF". */
export function Report() {
  useDB();
  const s = settings();
  const since = Date.now() - 14 * DAY;
  const usedThisMonth = get("settings", "report")?.month === monthKey();
  const born = s.birthMode === "postpartum";
  const p = s.hpl ? pregnancy(s.hpl) : null;

  function print() {
    put("settings", { id: "report", month: monthKey() });
    window.print();
  }

  const contractions = list("contractions").filter((c) => c.at >= since && c.end);
  const cs = contractionStats(contractions);
  const kicks = list("kicks").filter((k) => k.at >= since);
  const symptoms = list("symptoms").filter((x) => x.at >= since);
  const feeds = (["bottle", "breast", "pump", "diaper"] as const).flatMap((k) => list(k).filter((r) => r.at >= since).map((r) => ({ k, r })))
    .sort((a, b) => b.r.at - a.r.at);

  return (
    <>
      <div className="no-print"><TopBar title="Laporan" back="#/log" /></div>
      <div className="stack">
        <section className="card solid">
          <div className="card-title">Laporan 14 hari · {getPrefs().name || "Bunda"}</div>
          <div className="card-sub">
            Dibuat {dateLabel(Date.now())}{p ? ` · HPL ${dateLabel(s.hpl!)} · minggu ke-${p.week}` : ""}
          </div>
        </section>

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
            <div className="label">Menyusu & popok</div>
            {feeds.length === 0 ? <p className="muted" style={{ marginTop: 6 }}>Belum ada catatan.</p> : feeds.slice(0, 80).map(({ k, r }) => (
              <p key={r.id} className="num" style={{ marginTop: 6 }}>{dateLabel(r.at)} {timeLabel(r.at)} · {k === "diaper" ? `Popok ${DIAPER_LABEL[r.type]}` : describe(k, r)}</p>
            ))}
          </section>
        )}

        <div className="no-print stack" style={{ marginTop: 8 }}>
          <button className="btn btn-ink lg block" onClick={print} disabled={usedThisMonth}>
            {usedThisMonth ? "PDF bulan ini sudah dibuat" : "Simpan sebagai PDF"}
          </button>
          <p className="faint" style={{ fontSize: 14, textAlign: "center" }}>
            {usedThisMonth ? "Kuota gratis kembali awal bulan depan. Laporan tetap bisa dilihat di sini." : "1× gratis per bulan. Pilih “Simpan sebagai PDF” di jendela cetak."}
          </p>
        </div>
      </div>
    </>
  );
}
