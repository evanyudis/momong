import { Baby, BriefcaseMedical, ChevronRight, Gift, Settings as Gear, Sprout, Users } from "lucide-react";
import { BAG_DEFAULTS, weekNote } from "../content";
import { agoLabel, babyAge, dateLabel, isToday, pregnancy } from "../dates";
import { initial, useHousehold } from "../household";
import { getPrefs, get, list, saveSettings, settings, useDB } from "../store";
import { Header, Ring } from "../ui";
import { SyncDot } from "./Partner";

const GearLink = () => (
  <a className="icon-btn" href="#/pengaturan" aria-label="Pengaturan"><Gear size={20} /></a>
);

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
      <Header title={`Halo, ${getPrefs().name || "Bunda"}`} aside={<GearLink />} />
      <div className="stack">
        {p.daysLeft <= 0 && (
          <a className="card" href="#/pengaturan" style={{ background: "var(--accent-partner-soft)" }}>
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
          <div className="spread" style={{ alignItems: "center" }}>
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

        <div className="grid2">
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
    <a className="card" href="#/tas">
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
    <a className="card" href="#/kado">
      <div className="row">
        <span className="glyph peach" style={{ width: 40, height: 40 }}><Gift size={20} /></span>
        <div style={{ flex: 1 }}>
          <div className="card-title" style={{ fontSize: 16 }}>Daftar kado</div>
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
    <a className="card" href="#/pasangan">
      <div className="spread">
        <span className="row" style={{ gap: 8, fontWeight: 600 }}><Users size={20} color="var(--accent-primary-ink)" />Pasangan</span>
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

function NewbornHome() {
  const s = settings();
  const age = s.babyBirth ? babyAge(s.babyBirth) : null;
  const today = (col: Parameters<typeof list>[0]) => list(col).filter((r) => isToday(r.at));
  const bottles = today("bottle");
  const feeds = [...list("bottle"), ...list("breast")].sort((a, b) => b.at - a.at);
  const lastFeed = feeds[0];
  return (
    <>
      <Header title={`Halo, ${getPrefs().name || "Bunda"}`} aside={<GearLink />} />
      <div className="stack">
        <section className="card">
          <div className="row">
            <span className="glyph peach"><Baby size={24} /></span>
            <div>
              <div className="card-title">{s.babyName || "Si kecil"}</div>
              <div className="card-sub num">
                {age ? `${age.days} hari · ${age.weeks} minggu` : "Atur tanggal lahir di Pengaturan"}
              </div>
            </div>
          </div>
          <hr className="divider" style={{ margin: "16px 0" }} />
          <div className="label">Terakhir minum</div>
          <div className="stat" style={{ marginTop: 6 }}>
            {lastFeed ? (Date.now() - lastFeed.at < 60_000 ? "Baru saja" : <>{agoLabel(lastFeed.at)}<small> lalu</small></>) : <small>Belum ada catatan</small>}
          </div>
        </section>

        <section className="card">
          <div className="spread">
            <span className="label">Hari ini</span>
            <a className="link-btn" href="#/log" style={{ color: "inherit" }}>Catat <ChevronRight size={18} /></a>
          </div>
          <div className="grid2" style={{ marginTop: 6, rowGap: 18 }}>
            <Mini color="var(--semantic-feed)" label="Botol" value={`${bottles.reduce((n, r) => n + (r.ml || 0), 0)} ml`} />
            <Mini color="var(--accent-partner)" label="ASI" value={`${today("breast").length}×`} />
            <Mini color="var(--accent-primary)" label="Pompa" value={`${today("pump").reduce((n, r) => n + (r.ml || 0), 0)} ml`} />
            <Mini color="var(--warning)" label="Popok" value={`${today("diaper").length}×`} />
          </div>
        </section>

        <PartnerCard />
        <WishlistCard />
        {s.hpl && (
          <button className="link-btn faint" style={{ justifySelf: "center", fontWeight: 500 }} onClick={() => saveSettings({ birthMode: "pregnant" })}>
            Kembali ke mode hamil
          </button>
        )}
      </div>
    </>
  );
}
