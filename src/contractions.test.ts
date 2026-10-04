import assert from "node:assert/strict";
import { test } from "node:test";
import { alertVisible, analyzePattern, clock, distanceTier, durLabel, finished, gapLabel, intervalFor } from "./contractions.ts";

const MIN = 60_000;
const NOW = 1_800_000_000_000;
/** Contractions starting `gapMin` apart, ending `durSec` later, the last one starting at `NOW - 30s`. */
const series = (n: number, gapMin: number, durSec: number) =>
  Array.from({ length: n }, (_, i) => {
    const at = NOW - 30_000 - (n - 1 - i) * gapMin * MIN;
    return { id: `c${i}`, updatedAt: at, at, end: at + durSec * 1000 };
  });

test("pattern: 2 contractions → no alert", () => {
  assert.equal(analyzePattern(series(2, 2, 60), NOW), null);
});

test("pattern: 3 with gap < 5 min → Perhatian (warning)", () => {
  assert.equal(analyzePattern(series(3, 4.5, 30), NOW)?.level, "warning");
});

test("pattern: 4 with gap < 4 min and duration > 45s → Waktunya ke RS (critical)", () => {
  const p = analyzePattern(series(4, 3, 50), NOW);
  assert.equal(p?.level, "critical");
  assert.equal(p?.count, 4);
});

test("pattern: 4 close but short (≤ 45s) stays warning, loose gaps → no alert", () => {
  assert.equal(analyzePattern(series(4, 3, 45), NOW)?.level, "warning");
  // 3 inside the window, average gap exactly 5 min (not < 5) → no alert.
  const loose = [0, 5, 10].map((m, i) => ({ id: `l${i}`, updatedAt: 0, at: NOW - 10 * MIN + m * MIN, end: NOW - 10 * MIN + m * MIN + 60_000 }));
  assert.equal(analyzePattern(loose.map((c) => ({ ...c, end: Math.min(c.end, NOW) })), NOW), null);
});

test("pattern: only finished contractions inside the last 10 minutes count", () => {
  const running = { id: "run", updatedAt: NOW, at: NOW - 1000 };
  assert.equal(analyzePattern([...series(2, 2, 60), running], NOW), null);
  const old = series(4, 3, 50).map((c) => ({ ...c, at: c.at - 20 * MIN, end: c.end - 20 * MIN }));
  assert.equal(analyzePattern(old, NOW), null);
});

test("badge tiers: < 4m danger, 4 to < 5m warning, ≥ 5m calm, none for first", () => {
  assert.equal(distanceTier(null), null);
  assert.equal(distanceTier(3 * MIN + 59_000), "danger");
  assert.equal(distanceTier(4 * MIN), "warning");
  assert.equal(distanceTier(5 * MIN - 1), "warning");
  assert.equal(distanceTier(5 * MIN), "calm");
});

test("interval is start-to-start; stored values are kept, missing ones derived", () => {
  const a = { id: "a", updatedAt: 0, at: 0, end: 60_000 };
  const b = { id: "b", updatedAt: 0, at: 4 * MIN, end: 4 * MIN + 50_000 };
  // Start-to-start (4m), not end-to-start (3m).
  assert.equal(intervalFor(b.at, [a]), 4 * MIN);
  assert.equal(intervalFor(a.at, []), null);
  const out = finished([b, { ...a }, { id: "c", updatedAt: 0, at: 9 * MIN, end: 9 * MIN + 1000, interval: 123 }]);
  assert.deepEqual(out.map((c) => c.interval), [null, 4 * MIN, 123]);
});

test("labels", () => {
  assert.equal(gapLabel(3 * MIN + 40_000), "3m 40s");
  assert.equal(durLabel(72_000), "1m 12d");
  assert.equal(durLabel(45_000), "45d");
  assert.equal(clock(72_000), "01:12");
  assert.equal(clock(0), "00:00");
});

test("dismissal: warning returns when the set changes, critical snoozes 30 min", () => {
  const warn = analyzePattern(series(3, 4.5, 30), NOW)!;
  assert.equal(alertVisible(warn, { warningDismissedFor: warn.ids }, NOW), false);
  assert.equal(alertVisible(warn, { warningDismissedFor: "other" }, NOW), true);
  const crit = analyzePattern(series(4, 3, 50), NOW)!;
  assert.equal(alertVisible(crit, { warningDismissedFor: crit.ids }, NOW), true, "critical overrides a dismissed warning");
  assert.equal(alertVisible(crit, { criticalDismissedAt: NOW - 29 * MIN }, NOW), false);
  assert.equal(alertVisible(crit, { criticalDismissedAt: NOW - 30 * MIN }, NOW), true);
});
