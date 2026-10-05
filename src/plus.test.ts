import assert from "node:assert/strict";
import { test } from "node:test";
import { nextFeed, weeklyTotals } from "./plus.ts";
const rec = (at: number, ml = 0) => ({ id: String(at), updatedAt: at, at, ml });
test("estimate requires three distinct recent sessions and uses median intervals", () => {
  const now = Date.now(), hour = 3600000;
  assert.equal(nextFeed([rec(now), rec(now - hour)], now), null);
  assert.equal(nextFeed([rec(now), rec(now), rec(now - hour)], now), null);
  assert.deepEqual(nextFeed([rec(now - 4 * hour), rec(now - 2 * hour), rec(now)], now), { at: now + 2 * hour, samples: 3 });
  assert.equal(nextFeed([rec(now - 8 * 86400000), rec(now), rec(now + hour)], now), null);
});
test("weekly totals use actual log counts and pump volume, including empty days", () => {
  const now = new Date(2026, 9, 5, 12), at = now.getTime();
  const totals = weeklyTotals([{ kind: "bottle", r: rec(at, 90) }, { kind: "breast", r: rec(at) }, { kind: "pump", r: rec(at, 60) }, { kind: "diaper", r: rec(at) }], now);
  assert.equal(totals.length, 7);
  assert.deepEqual([totals[6].feeds, totals[6].pump, totals[6].diapers], [2, 60, 1]);
  assert.equal(totals[0].feeds, 0);
});
