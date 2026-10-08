import NewbornActivity from "../NewbornActivity";
import { newbornAgeLabel, description, totals } from "../newborn";
import { useEffect, useState } from "react";
import { PLUS_ENABLED } from "../release";
import { BriefcaseMedical, ChevronRight, Gift, Sprout, Users } from "lucide-react";
import { BAG_DEFAULTS, weekNote } from "../content";
import { agoLabel, dateLabel, isToday, pregnancy, timeLabel } from "../dates";
import { initial, useHousehold } from "../household";
import { nextFeed } from "../plus";
import { isPlus, getPrefs, get, list, saveSettings, settings, useDB } from "../store";
import { Header, PlusBadge, Ring } from "../ui";
import { SyncDot } from "./Partner";

export function Home() {
  useDB();
  const s = settings();
  return s.birthMode === "postpartum" ? <NewbornHome /> : <PregnancyHome />;
}

function PregnancyHome() {
  const s = settings();
  const p = pregnancy(s.hpl!);
  const today = (col: Parameters<typeof list>[0]) => list(col).filter((r) => isToday(r.at));
  const kickSession = list("kicks")[0];
  const kickToday = kickSession && isToday(kickSession.at) ? kickSession.count : 0;

  return (
    <>
      <Header title={`Halo, ${getPrefs().name || "Bunda"}`} />
      <div className="stack">
        {p.daysLeft <= 0 && (
          <a className="card" href="#/profil" data-morph="/profil" style={{ background: "var(--accent-partner-soft)" }}>
            <div className="spread">
              <div>
                <div className="card-title">Si kecil sudah lahir?</div>
                <div className="card-sub">Pindah ke mode newborn kapan pun kamu siap. Data hamil tetap tersimpan.</div>
              </div>
              <ChevronRight size={20} />
            </div>
          </a>
        )}

        <section className="card" aria-label="Kehamilan">
          <div className="spread pregnancy-summary">
            <div>
              <span className="pill warm"><span className="dot" />Trimester {p.trimester}</span>
              {/* Stacked so 3-digit counts never wrap "lagi" beside the number. */}
              <div style={{ marginTop: 14 }}>
                <div className="num" style={{ fontSize: 64, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1 }}>
                  {Math.max(p.daysLeft, 0)}
                </div>
                <div className="muted" style={{ fontSize: 18, marginTop: 4 }}>hari lagi</div>
              </div>
              <div style={{ fontWeight: 600, fontSize: 17, marginTop: 12 }}>HPL {dateLabel(s.hpl!)}</div>
              <div className="muted num" style={{ fontSize: 15, marginTop: 4 }}>Hari ke-{p.day} dari 280</div>
            </div>
            <Ring value={p.progress} size={128} stroke={11} knob>
              <div className="num" style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>{p.week}</div>
              <div className="muted" style={{ fontSize: 14 }}>minggu</div>
            </Ring>
          </div>
        </section>

        <section className="card">
          <div className="spread">
            <span className="label">Catatan hari ini</span>
            <a className="link-btn" href="#/log" style={{ color: "inherit" }}>Buka Log <ChevronRight size={18} /></a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", marginTop: 8 }}>
            <Mini color="var(--warning)" label="Kontraksi" value={`${today("contractions").length}×`} />
            <Mini color="var(--success)" label="Gerakan" value={`${kickToday}/10`} sep />
            <Mini color="var(--info)" label="Gejala" value={String(today("symptoms").length)} sep />
          </div>
        </section>

        <div className="grid2 home-shortcuts">
          <BagCard />
          <PartnerCard />
        </div>

        <WishlistCard />

        <section className="card">
          <div className="row">
            <span className="glyph mint" style={{ width: 36, height: 36 }}><Sprout size={18} /></span>
            <span className="card-title" style={{ fontSize: 16 }}>Catatan minggu ke-{p.week}</span>
          </div>
          <p className="muted" style={{ marginTop: 12, fontSize: 16, lineHeight: 1.5 }}>{weekNote(p.week)}</p>
        </section>
      </div>
    </>
  );
}

function Mini({ color, label, value, sep }: { color: string; label: string; value: string; sep?: boolean }) {
  return (
    <div className={sep ? "vsep" : undefined}>
      <div className="row" style={{ gap: 8, fontSize: 15 }}><span className="dot" style={{ background: color }} />{label}</div>
      <div className="stat" style={{ marginTop: 8 }}>{value}</div>
    </div>
  );
}

function BagCard() {
  const done = BAG_DEFAULTS.filter((d) => get("bag", d.id)?.checked).length +
    list("bag").filter((r) => r.custom && r.checked).length;
  const total = BAG_DEFAULTS.length + list("bag").filter((r) => r.custom).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <a className="card" href="#/tas" data-morph="/tas">
      <div className="spread">
        <span className="row" style={{ gap: 8, fontWeight: 600 }}><BriefcaseMedical size={20} color="var(--success-ink)" />Tas RS</span>
        <ChevronRight size={18} className="faint" />
      </div>
      <div className="spread" style={{ marginTop: 14 }}>
        <div className="stat num">{done}<small> / {total}</small></div>
        <Ring value={done / (total || 1)} size={44} stroke={6} />
      </div>
      <div style={{ color: "var(--success-ink)", fontSize: 14, fontWeight: 500, marginTop: 12 }}>
        {pct}% siap · {total - done} lagi
      </div>
    </a>
  );
}

function WishlistCard() {
  const items = list("wishlist");
  const left = items.filter((i) => !i.have).length;
  return (
    <a className="card" href="#/kado" data-morph="/kado">
      <div className="row">
        <span className="glyph peach" style={{ width: 40, height: 40 }}><Gift size={20} /></span>
        <div style={{ flex: 1 }}>
          <div className="card-title">Daftar kado</div>
          <div className="card-sub num">{items.length ? `${left} barang masih dibutuhkan` : "Buat daftar kebutuhan si kecil"}</div>
        </div>
        <ChevronRight size={20} className="faint" />
      </div>
    </a>
  );
}

export function PartnerCard() {
  const h = useHousehold();
  const myInitial = initial(h.myName || getPrefs().name || "B");
  let title = "Ajak pasangan";
  let sub = <span className="faint">Sinkron gratis, 2 kursi</span>;
  if (h.signedIn && h.partner) {
    title = `${h.partnerName} ikut mencatat`;
    sub = <SyncDot />;
  } else if (h.signedIn) {
    title = "Menunggu pasangan";
    sub = <SyncDot />;
  }
  return (
    <a className="card" href="#/pasangan" data-morph="/pasangan">
      <div className="spread">
        <span className="row card-title" style={{ gap: 8 }}><Users size={20} color="var(--accent-primary-ink)" />Pasangan</span>
        <ChevronRight size={18} className="faint" />
      </div>
      <div className="avatars" style={{ marginTop: 12 }}>
        <span className="avatar blue" style={{ width: 44, height: 44, fontSize: 16 }}>{myInitial}</span>
        <span className={`avatar ${h.partner ? "coral" : "vacant"}`} style={{ width: 44, height: 44, fontSize: 16 }}>
          {h.partner ? initial(h.partnerName) : "+"}
        </span>
      </div>
      <div style={{ fontWeight: 600, marginTop: 10, lineHeight: 1.25 }}>{title}</div>
      <div style={{ fontSize: 14, marginTop: 4 }}>{sub}</div>
    </a>
  );
}

function BabyArt() { return <svg className="baby-art" viewBox="0 0 140 140" aria-hidden="true"><path d="M20 85Q4 20 64 15Q127 3 130 68Q140 130 70 131Q21 137 20 85" fill="var(--nb-petal)"/><path d="M37 73Q29 42 69 37Q105 33 108 73L110 106Q73 126 34 102Z" fill="var(--surface)"/><circle cx="70" cy="64" r="25" fill="var(--nb-peach)"/><path d="M54 63q5-6 10 0m12 0q5-6 10 0m-22 12q7 6 14 0M68 40q-4-9 5-9" fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round"/><path d="M38 87q29 3 65 22M103 84q-21 11-51 30" stroke="var(--nb-petal)" strokeWidth="3" fill="none"/><path d="m13 25 3-7 3 7 7 3-7 3-3 7-3-7-7-3Z" fill="var(--nb-mint)"/></svg>; }
function NewbornHome() {
  const s = settings();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(id); }, []);
  const entries = (["bottle", "breast", "pump", "diaper"] as const).flatMap(kind => list(kind).map(r => ({...r, at:r.at as number, kind})));
  const feeds = entries.filter(e => e.kind === "bottle" || e.kind === "breast").sort((a,b) => b.at-a.at);
  const last = feeds[0], estimate = nextFeed(feeds);
  return <><Header title={`Halo, ${getPrefs().name || "Bunda"}`} /><div className="stack newborn-home">
    <section className="card newborn-hero"><div><p className="eyebrow">Si kecil</p><h2>{s.babyName || "Si kecil"}</h2><p className="muted num">{s.babyBirth ? newbornAgeLabel(s.babyBirth, new Date(now)) : "Atur tanggal lahir di Profil"}</p></div><BabyArt /></section>
    <NewbornActivity values={totals(entries, new Date(now))} onToday={() => { location.hash = "#/log?day=today"; }} />
    <section className="card care-card"><div className="spread"><h2 className="card-title">Terakhir minum</h2>{last && <span className="muted num">{timeLabel(last.at)}</span>}</div><div className="elapsed num">{last ? <>{agoLabel(last.at, now)}<small>{agoLabel(last.at, now) !== "baru saja" && " lalu"}</small></> : "Belum ada catatan minum"}</div><p className="card-sub">{last ? `${last.kind === "bottle" ? "Minum susu" : "Menyusu langsung"} · ${description(last)}` : "Ketuk + untuk mencatat susu atau menyusu."}</p></section>
    {isPlus() ? <a className="card feed-estimate" href="#/insight"><div className="feed-estimate-heading"><h2 className="card-title plus-wave-text">Perkiraan Susu</h2><PlusBadge size="small" /></div><p className="estimate-status">{estimate ? timeLabel(estimate.at) : "Butuh tiga sesi menyusu"}</p><p className="card-sub">{estimate ? `Dari ${estimate.samples} sesi dalam tujuh hari.${estimate.at < now ? " Waktu perkiraan sudah lewat." : ""}` : "Catat minum susu atau menyusu langsung untuk melihat pola."} Perkiraan non-klinis; ikuti kebutuhan si kecil.</p></a> : <section className="card feed-estimate"><div className="feed-estimate-heading"><h2 className="card-title plus-wave-text">Perkiraan Susu</h2><PlusBadge size="small" /></div><p className="estimate-status">{PLUS_ENABLED ? "Tersedia di Plus" : "Segera hadir"}</p><p className="card-sub">Perkiraan waktu minum dari pola catatan susu dan menyusu. Perkiraan non-klinis; ikuti kebutuhan si kecil.</p>{PLUS_ENABLED && <a className="link-btn" href="#/plus">Lihat Plus <ChevronRight size={16} /></a>}</section>}
    <PartnerCard /><WishlistCard />
    {s.hpl && <button className="link-btn faint" style={{justifySelf:"center",fontWeight:500}} onClick={() => saveSettings({birthMode:"pregnant"})}>Kembali ke mode hamil</button>}
  </div></>;
}
