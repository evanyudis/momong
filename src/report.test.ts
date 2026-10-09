import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReport } from "./report.ts";
const now = new Date(2026, 0, 3, 12).getTime();
const at = (day: number, hour = 10, minute = 0) => new Date(2026, 0, day, hour, minute).getTime();
const rec = (fields: Record<string, unknown>) => ({ id: "test", updatedAt: now, ...fields });
const base = { settings: { birthMode: "postpartum" as const, babyName: "Nara", babyBirth: "2025-12-20" }, name: "Sari", range: "7" as const, now };
test("newborn report separates consumed milk, pumping, missing volumes and mixed diapers", () => {
  const r = buildReport({ ...base, records: { bottle: [rec({ at: at(1), ml: 60, offeredMl: 90, remainingMl: 30, milk: "expressed" }), rec({ at: at(2), ml: 40, milk: "formula" })], pump: [rec({ at: at(1), ml: 120 }), rec({ at: at(2), ml: null })], breast: [rec({ at: at(1), minutes: 15, side: "left" })], diaper: [rec({ at: at(1), type: "both" })] } });
  assert.match(r.summary[1], /diminum 100 ml/);
  assert.match(r.summary[1], /ASI perah: 60 ml; formula: 40 ml/);
  assert.match(r.summary[1], /1 sesi\/hari pada 2 hari/);
  assert.match(r.summary[2], /120 ml; 1 sesi tanpa volume/);
  assert.match(r.summary[3], /1 kali; pipis 1 kejadian; pup 1 kejadian/);
  assert.match(r.coverage, /2 dari 7 hari/);
  assert.equal(r.chart.at(-1)?.ml, null);
  assert.match(r.details.rows[0][1], /ditawarkan 90 ml, sisa 30 ml/);
  assert.equal(r.tables[0].rows.length, 7);
});
test("calendar ranges cross years and exclude deleted, future and older records", () => {
  const r = buildReport({ ...base, records: { bottle: [rec({ at: new Date(2025, 11, 28).getTime(), ml: 0 }), rec({ at: new Date(2025, 11, 27, 23, 59).getTime(), ml: 80 }), rec({ at: now + 1, ml: 90 }), rec({ at: at(1), ml: 100, deleted: true })] } });
  assert.match(r.period, /2025.*2026/);
  assert.equal(r.details.rows.length, 1);
  assert.equal(r.chart[0].ml, 0);
  assert.match(r.coverage, /1 dari 7 hari/);
});
test("pregnancy interval is limited to latest ten minute group and incomplete sessions stay descriptive", () => {
  const r = buildReport({ ...base, settings: { birthMode: "pregnant", hpl: "2026-06-01" }, records: { contractions: [rec({ at: at(1), end: at(1) + 60000 }), rec({ at: at(2), end: at(2) + 60000 }), rec({ at: at(2, 10, 3), end: at(2, 10, 3) + 60000 }), rec({ at: at(3) })], kicks: [rec({ at: at(1), count: 10, done: true, last: at(1) + 120000 }), rec({ at: at(2), count: 4 })], symptoms: [rec({ at: at(1), name: "Mual", note: "Setelah sarapan" }), rec({ at: at(2), name: "Mual" })] } });
  assert.match(r.summary[0], /3 selesai; 1 belum selesai/);
  assert.match(r.summary[1], /1 sesi selesai; 1 sesi belum selesai/);
  assert.match(r.summary[3], /2 kontraksi; rata-rata jarak awal-ke-awal 3 mnt/);
  assert.equal(r.tables[0].rows[0][1], "2");
  assert.match(r.tables[1].rows[1][2], /Belum selesai/);
  assert.ok(r.details.rows.some(row => row[1].includes("Setelah sarapan")));
});
test("empty and all-record ranges remain usable without inventing data", () => {
  const empty = buildReport({ ...base, range: "all", records: {} });
  assert.match(empty.coverage, /0 dari 1 hari/);
  assert.equal(empty.chart[0].ml, null);
  const all = buildReport({ ...base, range: "all", records: { bottle: [rec({ at: at(1), ml: 20 })] } });
  assert.equal(all.tables[0].rows.length, 3);
  assert.match(all.context.join(" "), /14 hari/);
});
