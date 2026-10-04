import type { Rec } from "./store";

// Contraction pattern parity with v1 (momong-sot/PRD-CONTRACTION-PATTERN.md). Non-clinical: these are notes, not diagnosis.
const MIN = 60_000;
export const PATTERN_WINDOW_MS = 10 * MIN;
export const CRITICAL_SNOOZE_MS = 30 * MIN;

export type Finished = Rec & { at: number; end: number; interval: number | null };

/**
 * Finished contractions, oldest first, each with its start-to-start interval.
 * A stored `interval` wins; older records get it from the `at` order. The first has none.
 */
export function finished(items: Rec[]): Finished[] {
  const done = items.filter((c) => typeof c.end === "number").sort((a, b) => a.at - b.at);
  return done.map((c, i) => ({
    ...c,
    interval: typeof c.interval === "number" ? c.interval : i > 0 ? c.at - done[i - 1].at : null,
  })) as Finished[];
}

/** Interval to store when a running contraction ends: its start minus the previous finished start. */
export function intervalFor(start: number, items: Rec[]): number | null {
  const prev = items
    .filter((c) => typeof c.end === "number" && c.at < start)
    .reduce<Rec | null>((p, c) => (!p || c.at > p.at ? c : p), null);
  return prev ? start - prev.at : null;
}

export type Tier = "danger" | "warning" | "calm";
/** Distance badge: < 4 min danger, 4 to < 5 min warning, >= 5 min calm. */
export function distanceTier(interval: number | null): Tier | null {
  if (interval == null) return null;
  if (interval < 4 * MIN) return "danger";
  if (interval < 5 * MIN) return "warning";
  return "calm";
}

const split = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return [Math.floor(s / 60), s % 60] as const;
};
/** Distance label, e.g. "3m 40s". */
export const gapLabel = (ms: number) => { const [m, s] = split(ms); return `${m}m ${s}s`; };
/** Duration in Indonesian short form, e.g. "1m 12d" or "45d". */
export const durLabel = (ms: number) => { const [m, s] = split(ms); return m ? `${m}m ${s}d` : `${s}d`; };
/** Stopwatch, e.g. "01:12". */
export const clock = (ms: number) => { const [m, s] = split(ms); return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`; };

export type Pattern = { level: "critical" | "warning"; count: number; avgGap: number; avgDur: number; ids: string };

/** v1 analyzeContractionPattern: finished contractions that started in the last 10 minutes. */
export function analyzePattern(items: Rec[], now = Date.now()): Pattern | null {
  const recent = items
    .filter((c) => typeof c.end === "number" && c.at >= now - PATTERN_WINDOW_MS && c.at <= now)
    .sort((a, b) => a.at - b.at);
  if (recent.length < 3) return null;
  const gaps = recent.slice(1).map((c, i) => c.at - recent[i].at);
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const avgDur = recent.reduce((n, c) => n + (c.end - c.at), 0) / recent.length;
  const base = { count: recent.length, avgGap, avgDur, ids: recent.map((c) => c.id).join(",") };
  if (recent.length >= 4 && avgGap < 4 * MIN && avgDur > 45_000) return { level: "critical", ...base };
  if (avgGap < 5 * MIN) return { level: "warning", ...base };
  return null;
}

/**
 * Visibility after dismissal. Critical stays hidden 30 min after its dismissal.
 * Warning stays hidden until the set of contractions behind it changes (a finish or a delete).
 */
export function alertVisible(
  p: Pattern | null,
  d: { criticalDismissedAt?: number; warningDismissedFor?: string },
  now = Date.now(),
): boolean {
  if (!p) return false;
  if (p.level === "critical") return !d.criticalDismissedAt || now - d.criticalDismissedAt >= CRITICAL_SNOOZE_MS;
  return d.warningDismissedFor !== p.ids;
}
