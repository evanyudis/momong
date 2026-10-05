export async function createReportPDF(title: string, lines: string[], fontBase64: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ format: "a4", compress: true });
  doc.addFileToVFS("NotoSans.ttf", fontBase64);
  doc.addFont("NotoSans.ttf", "NotoSans", "normal");
  doc.setFont("NotoSans");
  doc.setProperties({ title: "Momong - Laporan", creator: "Momong" });
  let y = 22;
  function header() {
    doc.setFontSize(18); doc.setTextColor(45);
    doc.text("Momong", 18, 20);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text("Catatan, bukan saran medis.", 18, 28);
    y = 40;
  }
  header();
  doc.setFontSize(12); doc.setTextColor(45);
  for (const line of [title, "", ...lines]) {
    for (const part of doc.splitTextToSize(line || " ", 174) as string[]) {
      if (y > 270) { doc.addPage(); header(); doc.setFontSize(12); doc.setTextColor(45); }
      doc.text(part, 18, y); y += 6;
    }
    y += 2;
  }
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(9); doc.setTextColor(100);
    doc.text(`${i} / ${pages}`, 192, 285, { align: "right" });
  }
  return doc;
}

export async function downloadReportPDF(title: string, lines: string[], filename: string) {
  const response = await fetch("/NotoSans-Regular.ttf");
  if (!response.ok) throw new Error("pdf_font_unavailable");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  const doc = await createReportPDF(title, lines, btoa(binary));
  const url = URL.createObjectURL(doc.output("blob"));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
