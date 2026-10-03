const DAY = 24 * 60 * 60 * 1000;

/** Local midnight for a YYYY-MM-DD string or Date. */
export function midnight(d: string | Date): number {
  if (typeof d === "string") {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).getTime();
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Pregnancy progress from HPL (estimated due date), 280-day convention. */
export function pregnancy(hpl: string, today = new Date()) {
  const daysLeft = Math.round((midnight(hpl) - midnight(today)) / DAY);
  const day = Math.min(Math.max(280 - daysLeft, 0), 300);
  const week = Math.floor(day / 7);
  const trimester = week < 14 ? 1 : week < 28 ? 2 : 3;
  return { daysLeft, day, week, trimester, progress: Math.min(day / 280, 1) };
}

/** Baby age from birth date. */
export function babyAge(birth: string, today = new Date()) {
  const days = Math.max(0, Math.round((midnight(today) - midnight(birth)) / DAY));
  return { days, weeks: Math.floor(days / 7) };
}

export const isToday = (t: number, now = new Date()) => midnight(new Date(t)) === midnight(now);

const fmtDay = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" });
const fmtDate = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long" });
const fmtTime = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" });
export const dayLabel = (d = new Date()) => fmtDay.format(d);
export const dateLabel = (d: string | number | Date) => fmtDate.format(typeof d === "string" ? midnight(d) : d);
export const timeLabel = (t: number) => fmtTime.format(t);

export function durationLabel(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} dtk`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} mnt`;
  return `${Math.floor(m / 60)} j ${m % 60} mnt`;
}

export function agoLabel(t: number, now = Date.now()) {
  const m = Math.round((now - t) / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} jam` : `${Math.round(h / 24)} hari`;
}

export const todayISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
