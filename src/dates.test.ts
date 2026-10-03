import assert from "node:assert/strict";
import { test } from "node:test";
import { babyAge, durationLabel, pregnancy } from "./dates.ts";

test("pregnancy math matches the W1 reference (HPL 12 Nov, today 15 Oct)", () => {
  const p = pregnancy("2026-11-12", new Date(2026, 9, 15));
  assert.equal(p.daysLeft, 28);
  assert.equal(p.day, 252);
  assert.equal(p.week, 36);
  assert.equal(p.trimester, 3);
});

test("trimester boundaries", () => {
  assert.equal(pregnancy("2027-06-01", new Date(2026, 9, 1)).trimester, 1);
  const p = pregnancy("2026-11-12", new Date(2026, 9, 15));
  assert.ok(p.progress > 0.89 && p.progress < 0.91);
});

test("baby age and durations", () => {
  assert.deepEqual(babyAge("2026-10-01", new Date(2026, 9, 15)), { days: 14, weeks: 2 });
  assert.equal(durationLabel(38_000), "38 dtk");
  assert.equal(durationLabel(22 * 60_000), "22 mnt");
});
