import { test } from "node:test";
import assert from "node:assert/strict";
import { totals, newbornAgeLabel, clock, shiftDay, entriesOnDate, agendaTime } from "./newborn";
import { feedingDetails } from "./feeding";
test("daily totals use consumed volume, separate DBF and exclude yesterday",()=>{
 const now=new Date(2026,9,7,18).getTime();
 const details=feedingDetails("bottle",{at:now,ml:"180",remaining:"30",milk:"expressed",side:"",minutes:"",type:""},now);
 assert.equal(details.ml,150);
 assert.deepEqual(totals([{...details,id:"test",kind:"bottle"},{id:"dbf",kind:"breast",at:now,minutes:12},{id:"old",kind:"bottle",at:now-86400000,ml:500}],new Date(now)),[150,1,0,0]);
});

test("newborn age uses calendar months and completed years, including month end",()=>{
 assert.equal(newbornAgeLabel("2026-04-15", new Date(2026,9,7)), "25 minggu · 5 bulan 22 hari");
 assert.match(newbornAgeLabel("2025-04-07", new Date(2026,9,7)), /1 tahun 6 bulan$/);
 assert.match(newbornAgeLabel("2025-10-07", new Date(2026,9,7)), /1 tahun$/);
 assert.match(newbornAgeLabel("2026-01-31", new Date(2026,1,28)), /1 bulan$/);
 assert.match(newbornAgeLabel("2026-01-31", new Date(2026,2,1)), /1 bulan 1 hari$/);
 assert.match(newbornAgeLabel("2025-04-05", new Date(2026,9,7)), /1 tahun 6 bulan 2 hari$/);
 assert.match(newbornAgeLabel("2024-02-29", new Date(2025,1,28)), /1 tahun$/);
 assert.match(newbornAgeLabel("2026-10-07", new Date(2026,9,7)), /^0 minggu · 0 hari$/);
});

test("timer starts at zero before the next clock tick",()=>{
 assert.equal(clock(-999),"00:00");
 assert.equal(clock(65000),"01:05");
});

test("day agenda groups by local start, orders records and crosses midnight only in range",()=>{
 const start=new Date(2026,9,6,23,50).getTime();
 const overnight={id:"night",kind:"breast" as const,at:start,minutes:25,side:"left"};
 const morning={id:"morning",kind:"bottle" as const,at:new Date(2026,9,7,7).getTime(),ml:90};
 assert.deepEqual(entriesOnDate([morning,overnight],"2026-10-06"),[overnight]);
 assert.deepEqual(entriesOnDate([overnight,morning],"2026-10-07"),[morning]);
 assert.equal(agendaTime(overnight),"23.50–00.15");
 assert.equal(agendaTime(morning),"07.00");
 assert.equal(shiftDay("2026-01-01",-7),"2025-12-25");
 assert.equal(shiftDay("2024-02-28",1),"2024-02-29");
 assert.deepEqual(totals([overnight,morning],new Date(2026,9,7)),[90,0,0,0]);
 assert.deepEqual(totals([overnight,morning],new Date(2026,9,6)),[0,1,0,0]);
});
