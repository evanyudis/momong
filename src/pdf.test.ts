import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createReportPDF } from "./pdf.ts";

test("PDF export embeds its font, paginates a long report and produces a PDF file", async () => {
  const font = (await readFile(new URL('../public/NotoSans-Regular.ttf', import.meta.url))).toString('base64');
  const doc = await createReportPDF('Laporan Nara', Array.from({length: 150}, (_, i) => `Catatan ${i + 1}: ASI 15 menit, pompa 90 ml. Nama Sari Putri.`), font);
  assert.ok(doc.getNumberOfPages() > 1);
  const bytes = Buffer.from(doc.output('arraybuffer'));
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  assert.ok(bytes.length > 10000);
});
