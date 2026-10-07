import assert from "node:assert/strict";
import { test } from "node:test";
import { durationMinutes, feedingDetails, localDateTime, normalizePumpTags } from "./feeding";

const fields = { at: 1000, ml: "90", remaining: "25", milk: "expressed", side: "left", minutes: "15", type: "pee" };
test("bottle records offered, remaining and consumed, including an untouched bottle", () => {
  assert.deepEqual(feedingDetails("bottle", fields), { at: 1000, offeredMl: 90, remainingMl: 25, ml: 65, milk: "expressed" });
  assert.equal(feedingDetails("bottle", { ...fields, remaining: "90" }).ml, 0);
  assert.throws(() => feedingDetails("bottle", { ...fields, remaining: "91" }));
  for (const ml of ["", "NaN", "-1", "501"]) assert.throws(() => feedingDetails("bottle", { ...fields, ml }));
});
test("pumping supports all sides and clears volume when unmeasured", () => {
  for (const side of ["left", "right", "both"]) {
    assert.deepEqual(feedingDetails("pump", { ...fields, side, ml: "" }), { at: 1000, side, ml: null });
    assert.equal(feedingDetails("pump", { ...fields, side, ml: "0" }).ml, 0);
  }
  assert.throws(() => feedingDetails("pump", { ...fields, side: "invalid" }));
});
test("manual and timer durations preserve start time and sub-minute sessions", () => {
  assert.deepEqual(feedingDetails("breast", { ...fields, minutes: String(3500 / 60000) }), { at: 1000, side: "left", minutes: 3500 / 60000 });
  assert.equal(feedingDetails("breast", fields).minutes, 15);
  assert.throws(() => feedingDetails("breast", { ...fields, at: 2000 }, 1000));
  assert.throws(() => feedingDetails("breast", { ...fields, minutes: "" }));
  const date = new Date(2026, 9, 7, 9, 5);
  assert.equal(localDateTime(date.getTime()), "2026-10-07T09:05");
});


test("duration input uses minutes:seconds without decimal minutes", () => {
  assert.equal(durationMinutes("05:30"), "5.5");
  assert.equal(durationMinutes("00:06"), "0.1");
  assert.equal(durationMinutes("125:09"), "125.15");
  assert.equal(durationMinutes("1440:00"), "1440");
  for (const value of ["", "0.11", "05:60", "-1:00", "5:3", "1440:01"]) assert.throws(() => durationMinutes(value));
});


test("pump tags are custom, multiple, trimmed, bounded and deduplicated", () => {
  assert.deepEqual(normalizePumpTags(["Power pumping", " Malam ", "power pumping"]), ["Power pumping", "Malam"]);
  assert.deepEqual(normalizePumpTags([]), []);
  for (const value of [null, "tag", [""], [42], ["x".repeat(41)], Array(11).fill("tag")]) assert.throws(() => normalizePumpTags(value));
});
