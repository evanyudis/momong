import { durationLabel, isToday, midnight, timeLabel } from "../dates";
import { list, settings, useDB } from "../store";
import { Header } from "../ui";
import { contractionStats } from "./Log";

const DAY = 86_400_000;
const dayName = (t: number) => new Date(t).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });

export function Insight() {
  useDB();
  return settings().birthMode === "postpartum" ? <NewbornInsight /> : <PregnancyInsight />;
}

function PregnancyInsight() {
  const now = Date.now();
  const lastHour = contractionStats(list("contractions").filter((c) => c.at >= now - 60 * 60 * 1000));
  const today = contractionStats(list("contractions").filter((c) => isToday(c.at)));
  const sessions = list("kicks").slice(0, 7);
  const counts = new Map<string, number>();
  list("symptoms").filter((s) => s.at >= now - 7 * DAY).forEach((s) => counts.set(s.name, (counts.get(s.name) ?? 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <>
      <Header title="Insight" />
      <div className="stack">
        <section className="card">
          <div className="label">Pola kontraksi · 60 menit terakhir</div>
          <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1fr 1fr", marginTop: 12 }}>
            <div><div className="stat">{lastHour.count}×</div><div className="stat-label">kontraksi</div></div>
            <div className="vsep"><div className="stat">{lastHour.avgDur ? durationLabel(lastHour.avgDur) : "–"}</div><div className="stat-label">rata-rata durasi</div></div>
            <div className="vsep"><div className="stat">{lastHour.avgGap ? durationLabel(lastHour.avgGap) : "–"}</div><div className="stat-label">rata-rata jarak</div></div>
          </div>
          <p className="muted" style={{ fontSize: 14, marginTop: 14 }}>
            Hari ini {today.count}× kontraksi. Angka ini catatan, bukan diagnosis. Tunjukkan ke bidan atau dokter kalau kamu ragu.
          </p>
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
  return (
    <>
      <Header title="Insight" />
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
                    Botol {bottle.reduce((n, r) => n + (r.ml || 0), 0)} ml ({bottle.length}×) · ASI {inDay("breast", d).length}× ·
                    Pompa {inDay("pump", d).reduce((n, r) => n + (r.ml || 0), 0)} ml · Popok {inDay("diaper", d).length}×
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
