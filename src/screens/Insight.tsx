import { PlusMesh } from "../PlusMesh";
import { PLUS_ENABLED } from "../release";
import { nextFeed, weeklyTotals } from "../plus";
import { lazy, Suspense, useState } from "react";

const FeedingChart = lazy(() => import("../FeedingChart"));
import type { PlusVariant } from "../content";
import { durationLabel, isToday, midnight, timeLabel } from "../dates";
import { isPlus, list, settings, useDB } from "../store";
import { BlurBars, Header, PlusBadge, PlusPill, PlusSheet } from "../ui";
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
  const hasRecords = (["bottle", "breast", "pump", "diaper"] as const).some((kind) => list(kind).some((r) => r.at >= days[6]));
  const hasToday = (["bottle", "breast", "pump", "diaper"] as const).some((kind) => list(kind).some((r) => r.at >= start));
  const [preview, setPreview] = useState(true);
  const [plus, setPlus] = useState<PlusVariant | null>(null);
  return (
    <>
      <Header title="Insight" />
      {!isPlus() && !hasToday && <section className="card empty"><strong>Belum ada catatan hari ini</strong><p>Catat menyusu, pompa, atau popok untuk melihat ringkasannya.</p><a className="btn btn-ink" href="#/log">Buka Log</a></section>}
      {isPlus() && <PlusInsights />}
      {!isPlus() && hasRecords && preview && (
        <section className="card plus-card" style={{ marginBottom: 14 }}><PlusMesh />
          <div className="spread">
            <div className="card-title">Pola menyusu 7 hari</div>
            <PlusPill />
          </div>
          <BlurBars />
          <button className="btn btn-coral block" style={{ marginTop: 16 }} disabled={!PLUS_ENABLED} aria-haspopup={PLUS_ENABLED ? "dialog" : undefined} onClick={() => setPlus("insights")}>{PLUS_ENABLED ? "Coba Plus" : "Segera hadir"}</button>
          <button className="btn btn-soft block" style={{ marginTop: 10 }} onClick={() => setPreview(false)}>Nanti saja</button>
        </section>
      )}
      {!isPlus() && hasRecords && <section className="card">
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
      </section>}
      <PlusSheet variant={plus} onClose={() => setPlus(null)} />
    </>
  );
}

const METRICS = [
  { key: "feeds", label: "Menyusu", unit: "sesi", color: "var(--accent-partner-ink)" },
  { key: "pump", label: "Pumping", unit: "ml", color: "var(--accent-primary-ink)" },
  { key: "diapers", label: "Popok", unit: "kali", color: "var(--warning-ink)" },
] as const;

function PlusInsights() {
  const [metric, setMetric] = useState<(typeof METRICS)[number]>(METRICS[0]);
  const records = (["bottle", "breast", "pump", "diaper"] as const).flatMap((kind) => list(kind).map((r) => ({ kind, r })));
  const estimate = nextFeed(records.filter(({ kind }) => kind === "bottle" || kind === "breast").map(({ r }) => r));
  const days = weeklyTotals(records);
  const chart = days.map((day) => ({ ...day, day: new Date(day.at).toLocaleDateString("id-ID", { weekday: "short" }), date: dayName(day.at) }));
  const total = days.reduce((sum, day) => sum + day[metric.key], 0);
  return <div className="stack newborn-insights">
    <section className="card stack feed-estimate">
      <div className="feed-estimate-heading"><h2>Perkiraan Susu</h2><PlusBadge size="small" /></div>
      {estimate ? <><p className="estimate-time num">{timeLabel(estimate.at)}</p><p className="muted">Dari {estimate.samples} sesi dalam tujuh hari.{estimate.at < Date.now() ? " Waktu perkiraan sudah lewat." : ""}</p></>
        : <><h3>Kenali polanya, sedikit demi sedikit.</h3><p className="muted">Catat minimal 3 sesi minum susu atau menyusu langsung dalam 7 hari untuk melihat perkiraan.</p><a className="link-btn" href="#/log">Catat sesi menyusu →</a></>}
      <p className="insight-note">Berdasarkan catatan, bukan jadwal wajib atau saran medis. Ikuti kebutuhan si kecil.</p>
    </section>
    <section className="card stack">
      <div><h2>Minggu si kecil</h2><p className="card-sub">{dayName(days[0].at)} – {dayName(days[6].at)}</p></div>
      <div className="insight-totals">{METRICS.map((item) => <div key={item.key}><span className="stat-label">{item.label}</span><strong className="num">{days.reduce((sum, day) => sum + day[item.key], 0)}<small> {item.unit}</small></strong></div>)}</div>
      <p className="insight-note">Menyusu mencakup minum susu dan menyusu langsung.</p>
    </section>
    <section className="card stack insight-chart-card">
      <div className="spread"><h2>Pola harian</h2><span className="label">7 hari</span></div>
      <div className="insight-metrics" role="group" aria-label="Metrik grafik">{METRICS.map((item) => <button key={item.key} type="button" aria-pressed={metric.key === item.key} onClick={() => setMetric(item)}>{item.label}</button>)}</div>
      <div className="spread"><strong>{metric.label}</strong><span className="muted num">{total} {metric.unit} · total</span></div>
      {total === 0 ? <div className="empty"><strong>Belum ada catatan {metric.label.toLowerCase()}</strong><p>Mulai mencatat untuk melihat pola minggu ini.</p><a className="link-btn" href="#/log">Buka Log →</a></div> :
        <div className="insight-chart" aria-label={`Grafik ${metric.label.toLowerCase()} tujuh hari dalam ${metric.unit}`}>
          <Suspense fallback={<p role="status">Memuat grafik…</p>}><FeedingChart days={chart} metric={metric} /></Suspense>
        </div>}
      <details className="insight-details"><summary>Detail harian</summary><div className="list">{days.map((day) => <div className="spread" key={day.at}><span>{dayName(day.at)}</span><span className="num">{day[metric.key]} {metric.unit}</span></div>)}</div></details>
    </section>
  </div>;
}
