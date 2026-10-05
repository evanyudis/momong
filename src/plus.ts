import { midnight } from "./dates";
import { type Rec } from "./store";

export function nextFeed(records: Rec[], now = Date.now()) {
  const times = [...new Set(records.filter((r) => Number.isFinite(r.at) && r.at <= now && r.at >= now - 7 * 86400000).map((r) => r.at as number))].sort((a, b) => a - b).slice(-20);
  if (times.length < 3) return null;
  const gaps = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const interval = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
  return { at: times[times.length - 1] + interval, samples: times.length };
}

export function weeklyTotals(records: { kind: string; r: Rec }[], now = new Date()) {
  const start = midnight(now);
  return Array.from({ length: 7 }, (_, i) => {
    const at = new Date(start); at.setDate(at.getDate() - (6 - i));
    const end = new Date(at); end.setDate(end.getDate() + 1);
    const rows = records.filter(({ r }) => r.at >= at.getTime() && r.at < end.getTime());
    return { at: at.getTime(), feeds: rows.filter(({ kind }) => kind === "bottle" || kind === "breast").length,
      pump: rows.filter(({ kind }) => kind === "pump").reduce((n, { r }) => n + (Number.isFinite(r.ml) ? r.ml : 0), 0),
      diapers: rows.filter(({ kind }) => kind === "diaper").length };
  });
}
