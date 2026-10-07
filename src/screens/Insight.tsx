import { nextFeed, weeklyTotals } from "../plus";
import { useState } from "react";
import type { PlusVariant } from "../content";
import { durationLabel, isToday, midnight, timeLabel } from "../dates";
import { isPlus, list, settings, useDB } from "../store";
import { BlurBars, Header, PlusPill, PlusSheet } from "../ui";
import { contractionStats, PatternAlert } from "./Log";

const DAY = 86_400_000;
const dayName = (t: number) => new Date(t).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });

export function Insight() {
  useDB();
  return settings().birthMode === "postpartum" ? <NewbornInsight /> : <PregnancyInsight />;
}

function PregnancyInsight() {
  const now = Date.now();
  const today = contractionStats(list("contractions").filter((c) => isToday(c.at)));
  const sessions = list("kicks").slice(0, 7);
  const counts = new Map<string, number>();
  list("symptoms").filter((s) => s.at >= now - 7 * DAY).forEach((s) => counts.set(s.name, (counts.get(s.name) ?? 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <>
      <Header title="Insight" />
      <div className="stack">
        <PatternAlert />
        <section className="card">
          <div className="label">Kontraksi hari ini</div>
          <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1fr 1fr", marginTop: 12 }}>
            <div><div className="stat">{today.count}×</div><div className="stat-label">kontraksi</div></div>
            <div className="vsep"><div className="stat">{today.avgDur ? durationLabel(today.avgDur) : "–"}</div><div className="stat-label">rata-rata durasi</div></div>
            <div className="vsep"><div className="stat">{today.avgGap ? durationLabel(today.avgGap) : "–"}</div><div className="stat-label">rata-rata jarak</div></div>
          </div>
          <p className="muted" style={{ fontSize: 14, marginTop: 14 }}>Angka ini catatan, bukan diagnosis.</p>
        </section>

        <section className="card">
          <div className="label">Sesi hitung gerakan</div>
          {sessions.length === 0 ? (
            <div className="empty"><strong>Belum ada sesi</strong>Mulai sesi dari tab Log saat si kecil aktif.</div>
          ) : (
            <div className="list" style={{ marginTop: 4 }}>
              {sessions.map((k) => (
                <div key={k.id} className="list-row">
                  <div className="grow">
                    <div className="title num">{dayName(k.at)} · {timeLabel(k.at)}</div>
                    <div className="sub num">{k.done ? `10 gerakan dalam ${durationLabel(k.last - k.at)}` : `${k.count} gerakan`}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="label">Gejala 7 hari terakhir</div>
          {top.length === 0 ? (
            <div className="empty"><strong>Belum ada gejala</strong>Catat dari tab Log; ringkasannya muncul di sini.</div>
          ) : (
            <div className="list" style={{ marginTop: 4 }}>
              {top.map(([name, n]) => (
                <div key={name} className="list-row"><div className="grow title">{name}</div><span className="pill num">{n}×</span></div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function NewbornInsight() {
  const start = midnight(new Date());
  const days = Array.from({ length: 7 }, (_, i) => start - i * DAY);
  const inDay = (col: Parameters<typeof list>[0], d: number) => list(col).filter((r) => r.at >= d && r.at < d + DAY);
  const [preview, setPreview] = useState(true);
  const [plus, setPlus] = useState<PlusVariant | null>(null);
  return (
    <>
      <Header title="Insight" />
      {isPlus() && <PlusInsights />}
      {!isPlus() && preview && (
        <section className="card plus-card" style={{ marginBottom: 14 }}>
          <div className="spread">
            <div className="card-title">Pola menyusu 7 hari</div>
            <PlusPill />
          </div>
          <BlurBars />
          <button className="btn btn-coral block" style={{ marginTop: 16 }} aria-haspopup="dialog" onClick={() => setPlus("insights")}>Coba Plus</button>
          <button className="btn btn-soft block" style={{ marginTop: 10 }} onClick={() => setPreview(false)}>Nanti saja</button>
        </section>
      )}
      <section className="card">
        <div className="label">7 hari terakhir</div>
        <div className="list" style={{ marginTop: 4 }}>
          {days.map((d) => {
            const bottle = inDay("bottle", d);
            return (
              <div key={d} className="list-row">
                <div className="grow">
                  <div className="title">{d === start ? "Hari ini" : dayName(d)}</div>
                  <div className="sub num">
                    Minum susu {bottle.reduce((n, r) => n + (r.ml || 0), 0)} ml ({bottle.length}×) · Menyusu langsung {inDay("breast", d).length}× ·
                    Pumping {inDay("pump", d).reduce((n, r) => n + (r.ml || 0), 0)} ml · Ganti popok {inDay("diaper", d).length}×
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <PlusSheet variant={plus} onClose={() => setPlus(null)} />
    </>
  );
}

function PlusInsights() {
  const records = (["bottle", "breast", "pump", "diaper"] as const).flatMap((kind) => list(kind).map((r) => ({ kind, r })));
  const estimate = nextFeed(records.filter(({ kind }) => kind === "bottle" || kind === "breast").map(({ r }) => r));
  const days = weeklyTotals(records);
  return <div className="stack" style={{ marginBottom: 14 }}>
    <section className="card stack">
      <h2>Perkiraan menyusu berikutnya</h2>
      {estimate ? <><p className="stat num">{timeLabel(estimate.at)}</p><p className="muted">Perkiraan dari {estimate.samples} catatan terakhir.{estimate.at < Date.now() ? " Waktu perkiraan sudah lewat." : ""}</p></>
        : <p className="muted">Catat minimal 3 sesi minum susu atau menyusu langsung dalam 7 hari untuk melihat perkiraan.</p>}
      <p className="faint">Berdasarkan kebiasaan catatan, bukan jadwal wajib atau saran medis. Ikuti kebutuhan si kecil.</p>
    </section>
    {([['feeds', 'Menyusu', 'sesi'], ['pump', 'Pumping', 'ml'], ['diapers', 'Ganti popok', 'kali']] as const).map(([key, label, unit]) => {
      const max = Math.max(1, ...days.map((d) => d[key]));
      return <section className="card stack" key={key}>
        <h2>{label} · 7 hari</h2>
        {days.every((d) => d[key] === 0) ? <p className="muted">Belum ada catatan. Mulai dari tab Log.</p> : <>
          <svg viewBox="0 0 280 100" role="img" aria-label={`Grafik ${label.toLowerCase()} 7 hari; angka tersedia di bawah`}>
            {days.map((d, i) => <rect key={d.at} x={i * 40 + 8} y={95 - d[key] / max * 85} width={24} height={d[key] / max * 85} rx={4} fill="var(--accent-primary)" />)}
          </svg>
          <div className="list">{days.map((d) => <div className="spread" key={d.at}><span>{new Date(d.at).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}</span><span className="num">{d[key]} {unit}</span></div>)}</div>
        </>}
      </section>;
    })}
  </div>;
}
