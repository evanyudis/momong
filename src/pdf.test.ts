import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createReportPDF, downloadReportPDF } from "./pdf.ts";
import { buildReport } from "./report.ts";
const report = () => buildReport({ settings: { birthMode: "postpartum" }, name: "Sari Putri", range: "14", now: Date.now(), records: {} });

test("PDF export embeds its font, paginates a long report and produces a PDF file", async () => {
  const font = (await readFile(new URL('../public/NotoSans-Regular.ttf', import.meta.url))).toString('base64');
  const data = report();
  data.details.rows = Array.from({ length: 150 }, (_, i) => ["1 Jan 2026", `Catatan ${i + 1}: ASI 15 menit, pompa 90 ml. Nama Sari Putri.`]);
  data.details.rows.push(["2 Jan 2026", "Catatan panjang ".repeat(1000) + "AKHIR CATATAN"]);
  const doc = await createReportPDF(data, font);
  assert.ok(doc.getNumberOfPages() > 1);
  const bytes = Buffer.from(doc.output('arraybuffer'));
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  assert.ok(bytes.length > 10000);
});

test("failed font loading rejects export before creating a download", async () => {
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = async () => new Response("missing", { status: 503 });
  try { await assert.rejects(downloadReportPDF(report(), "momong.pdf"), /pdf_font_unavailable/); }
  finally { globalThis.fetch = fetchBefore; }
});
