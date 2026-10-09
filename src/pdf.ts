import type { ReportData, ReportTable } from "./report";

export async function createReportPDF(report: ReportData, fontBase64: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ format: "a4", compress: true });
  doc.addFileToVFS("NotoSans.ttf", fontBase64);
  doc.addFont("NotoSans.ttf", "NotoSans", "normal");
  doc.setFont("NotoSans");
  doc.setProperties({ title: `Momong - ${report.title}`, creator: "Momong" });
  const left = 18, width = 174, bottom = 270;
  let y = 38;
  function header() {
    doc.setFillColor(126, 184, 212); doc.rect(left, 17, 9, 2, "F");
    doc.setFontSize(12); doc.setTextColor(50); doc.text("Momong", 31, 21);
    doc.setFontSize(8); doc.setTextColor(100); doc.text("CATATAN UNTUK KONSULTASI", 192, 21, { align: "right" });
    doc.setDrawColor(230); doc.line(left, 27, 192, 27);
    y = 38;
  }
  function page() { doc.addPage(); header(); }
  function text(value: string, size = 10.5, muted = false) {
    doc.setFontSize(size); doc.setTextColor(muted ? 100 : 50);
    const lines = doc.splitTextToSize(value, width) as string[];
    for (const line of lines) {
      if (y + 5 > bottom) { page(); doc.setFontSize(size); doc.setTextColor(muted ? 100 : 50); }
      doc.text(line, left, y); y += size * 0.48;
    }
    y += 3;
  }
  function heading(title: string) { if (y + 22 > bottom) page(); y += 4; text(title, 13); }
  function table(t: ReportTable) {
    doc.setFontSize(10);
    const firstHeight = t.rows.length ? Math.max(...t.rows[0].map((cell, i) => (doc.splitTextToSize(cell, t.widths[i] - 6) as string[]).length)) * 4.8 + 6 : 10;
    const headHeight = Math.max(...t.columns.map((cell, i) => (doc.splitTextToSize(cell, t.widths[i] - 6) as string[]).length)) * 4.8 + 6;
    if (y + 18 + headHeight + Math.min(firstHeight, 40) > bottom) page();
    heading(t.title);
    if (!t.rows.length) { text("Belum ada catatan dalam periode ini.", 10, true); return; }
    function cells(row: string[], head = false) {
      doc.setFontSize(10);
      const wrapped = row.map((cell, i) => doc.splitTextToSize(cell, t.widths[i] - 6) as string[]);
      let offset = 0;
      const length = Math.max(...wrapped.map(lines => lines.length));
      const headerHeight = Math.max(...t.columns.map((cell, i) => (doc.splitTextToSize(cell, t.widths[i] - 6) as string[]).length)) * 4.8 + 6;
      if (!head && y + length * 4.8 + 6 > bottom && length * 4.8 + 6 <= bottom - 38 - headerHeight) { page(); cells(t.columns, true); }
      while (offset < length) {
        if (y + 10.8 > bottom) { page(); if (!head) cells(t.columns, true); }
        const count = Math.min(length - offset, Math.floor((bottom - y - 6) / 4.8));
        const height = count * 4.8 + 6;
        if (head) { doc.setFillColor(240, 245, 247); doc.rect(left, y, width, height, "F"); }
        doc.setFontSize(10); doc.setTextColor(head ? 65 : 50);
        let x = left;
        wrapped.forEach((lines, i) => {
          lines.slice(offset, offset + count).forEach((line, j) => {
            const right = !head && t.numeric?.includes(i);
            doc.text(line, right ? x + t.widths[i] - 3 : x + 3, y + 6 + j * 4.8, { align: right ? "right" : "left" });
          });
          x += t.widths[i];
        });
        y += height; doc.setDrawColor(235); doc.line(left, y, 192, y);
        offset += count;
      }
    }
    cells(t.columns, true);
    t.rows.forEach(row => cells(row));
    y += 6;
  }
  header();
  text(report.title, 21);
  text(report.period, 11, true);
  report.context.forEach(line => text(line));
  text(`Dibuat ${report.generated}`, 9, true);
  heading("Cakupan pencatatan"); text(report.coverage);
  heading("Ringkasan periode"); report.summary.forEach(line => text(line));
  heading("Cara membaca laporan"); report.notes.forEach(line => text(line, 9, true));
  if (report.chart.some(day => day.ml !== null)) {
    page(); heading("Susu botol yang diminum per hari");
    text("Volume tercatat (ml). Tanda - berarti tidak ada volume tercatat, bukan nol konsumsi.", 9, true);
    const max = Math.max(1, ...report.chart.map(day => day.ml ?? 0));
    for (const day of report.chart) {
      if (y + 9 > bottom) { page(); heading("Susu botol per hari (lanjutan)"); }
      doc.setFontSize(9); doc.setTextColor(65); doc.text(day.date, left, y);
      if (day.ml !== null && day.ml > 0) { doc.setFillColor(126, 184, 212); doc.rect(58, y - 3, day.ml / max * 108, 4, "F"); }
      doc.text(day.ml === null ? "-" : day.ml.toLocaleString("id-ID", { maximumFractionDigits: 1 }), 192, y, { align: "right" }); y += 8;
    }
  }
  report.tables.forEach(table);
  page(); table(report.details);
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(100);
    doc.setDrawColor(230); doc.line(left, 278, 192, 278);
    doc.text(report.period, left, 285);
    doc.text(`${i} / ${pages}`, 192, 285, { align: "right" });
  }
  return doc;
}

export async function downloadReportPDF(report: ReportData, filename: string) {
  const response = await fetch("/NotoSans-Regular.ttf");
  if (!response.ok) throw new Error("pdf_font_unavailable");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  const doc = await createReportPDF(report, btoa(binary));
  const url = URL.createObjectURL(doc.output("blob"));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
