import { babyAge, durationLabel, midnight, pregnancy, todayISO } from "./dates";
import { description, type Entry, type Kind } from "./newborn";
import { PATTERN_WINDOW_MS } from "./contractions";
import type { Rec, Settings } from "./store";

export type ReportTable = { title: string; columns: string[]; widths: number[]; rows: string[][]; numeric?: number[] };
export type ReportData = { title: string; period: string; generated: string; context: string[]; coverage: string; summary: string[]; notes: string[]; tables: ReportTable[]; chart: { date: string; ml: number | null }[]; details: ReportTable };
type Input = { settings: Settings; name: string; range: "7" | "14" | "30" | "all"; now: number; records: Partial<Record<Kind | "contractions" | "kicks" | "symptoms", Rec[]>> };
const fullDate = (at: number | string) => new Date(typeof at === "string" ? midnight(at) : at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
const time = (at: number) => new Date(at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
const number = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 1 });
const value = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;

export function buildReport({ settings: s, name, range, now, records }: Input): ReportData {
  const born = s.birthMode === "postpartum";
  const kinds = born ? ["bottle", "breast", "pump", "diaper"] as const : ["contractions", "kicks", "symptoms"] as const;
  const all = kinds.flatMap(kind => (records[kind] ?? []).filter(r => !r.deleted && value(r.at) && r.at <= now).map(r => ({ kind, r }))).sort((a, b) => a.r.at - b.r.at);
  const startDate = new Date(midnight(new Date(now)));
  if (range === "all") startDate.setTime(all.length ? midnight(new Date(all[0].r.at)) : startDate.getTime());
  else startDate.setDate(startDate.getDate() - Number(range) + 1);
  const start = startDate.getTime();
  const items = all.filter(({ r }) => r.at >= start);
  const days: string[] = [];
  for (const d = new Date(start); d.getTime() <= midnight(new Date(now)); d.setDate(d.getDate() + 1)) days.push(todayISO(d));
  const onDay = (day: string) => items.filter(({ r }) => todayISO(new Date(r.at)) === day);
  const rowsFor = (kind: typeof kinds[number]) => items.filter(i => i.kind === kind).map(i => i.r);
  const coverage = new Set(items.map(({ r }) => todayISO(new Date(r.at)))).size;
  const report: ReportData = {
    title: born ? "Ringkasan konsultasi bayi" : "Ringkasan konsultasi kehamilan",
    period: `${fullDate(start)} - ${fullDate(now)}`,
    generated: `${fullDate(now)}, ${time(now)} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
    context: [name ? `Ibu: ${name}` : "Nama ibu belum dicatat", `Bayi: ${s.babyName || "Belum dicatat"}`],
    coverage: `${coverage} dari ${days.length} hari memiliki catatan; ${items.length} catatan dalam periode ini.`,
    summary: [], notes: ["Berdasarkan catatan pengguna, bukan diagnosis atau penilaian kecukupan. Aktivitas yang tidak dicatat tidak tercakup.", "Tanggal dan pengelompokan harian mengikuti zona waktu perangkat saat laporan dibuat. Hari ini mencakup catatan hingga waktu pembuatan."],
    tables: [], chart: [],
    details: { title: "Lampiran catatan", columns: ["Tanggal / jam", "Aktivitas dan catatan"], widths: [35, 139], rows: [] },
  };
  if (born) {
    if (s.babyBirth) report.context.push(`Lahir: ${fullDate(s.babyBirth)}; usia saat laporan dibuat: ${babyAge(s.babyBirth, new Date(now)).days} hari (${babyAge(s.babyBirth, new Date(now)).weeks} minggu)`);
    else report.context.push("Tanggal lahir belum dicatat");
    const bottles = rowsFor("bottle"), breasts = rowsFor("breast"), pumps = rowsFor("pump"), diapers = rowsFor("diaper");
    const sum = (rs: Rec[], key: string) => rs.reduce((n, r) => n + (value(r[key]) ? r[key] : 0), 0);
    const volume = (rs: Rec[]) => rs.some(r => value(r.ml)) ? `${number(sum(rs, "ml"))} ml` : "volume tidak dicatat";
    const categoryDays = (rs: Rec[]) => new Set(rs.map(r => todayISO(new Date(r.at)))).size;
    const avg = (rs: Rec[]) => rs.length ? `${number(rs.length / categoryDays(rs))} sesi/hari pada ${categoryDays(rs)} hari dengan catatan kategori ini` : "belum ada catatan";
    report.summary = [
      breasts.length ? `Menyusu langsung: ${breasts.length} sesi; ${number(sum(breasts, "minutes"))} menit tercatat (${breasts.filter(r => value(r.minutes)).length} sesi dengan durasi). ${avg(breasts)}.` : "Menyusu langsung: belum ada catatan.",
      bottles.length ? `Susu botol: ${bottles.length} sesi; diminum ${volume(bottles)}. ASI perah: ${volume(bottles.filter(r => r.milk === "expressed"))}; formula: ${volume(bottles.filter(r => r.milk === "formula"))}. ${avg(bottles)}.` : "Susu botol: belum ada catatan.",
      pumps.length ? `Pumping: ${pumps.length} sesi; hasil ${volume(pumps)}; ${pumps.filter(r => !value(r.ml)).length} sesi tanpa volume.` : "Pumping: belum ada catatan.",
      diapers.length ? `Ganti popok: ${diapers.length} kali; pipis ${diapers.filter(r => r.type === "pee" || r.type === "both").length} kejadian; pup ${diapers.filter(r => r.type === "poo" || r.type === "both").length} kejadian.` : "Ganti popok: belum ada catatan.",
    ];
    report.notes.push("Volume botol adalah susu yang diminum, bukan yang ditawarkan. Hasil pumping tidak dijumlahkan sebagai konsumsi bayi; durasi menyusu tidak dikonversi ke ml. Popok pipis & pup masuk ke kedua jenis kejadian, tetapi dihitung satu kali ganti.");
    report.tables.push({ title: "Aktivitas per hari", columns: ["Tanggal", "Menyusu langsung", "Botol diminum", "Pumping", "Popok"], widths: [31, 39, 34, 35, 35], numeric: [1, 2, 3, 4], rows: items.length ? days.map(day => {
      const daily = onDay(day);
      const rs = (kind: Kind) => daily.filter(i => i.kind === kind).map(i => i.r);
      const b = rs("breast"), bottle = rs("bottle"), pump = rs("pump"), diaper = rs("diaper");
      return [fullDate(day), b.length ? `${b.length} sesi / ${b.some(r => value(r.minutes)) ? `${number(sum(b, "minutes"))} mnt` : "durasi tidak dicatat"}` : "Tidak dicatat", bottle.length ? `${bottle.length} sesi / ${volume(bottle)}` : "Tidak dicatat", pump.length ? `${pump.length} sesi / ${volume(pump)}` : "Tidak dicatat", diaper.length ? `${diaper.length} ganti; ${diaper.filter(r => r.type !== "poo").length} pipis / ${diaper.filter(r => r.type !== "pee").length} pup` : "Tidak dicatat"];
    }) : [] });
    report.chart = days.map(day => { const rs = onDay(day).filter(i => i.kind === "bottle").map(i => i.r); return { date: fullDate(day), ml: rs.some(r => value(r.ml)) ? sum(rs, "ml") : null }; });
  } else {
    if (s.hpl) report.context.push(`HPL: ${fullDate(s.hpl)}; usia kehamilan saat laporan dibuat: ${pregnancy(s.hpl, new Date(now)).week} minggu`);
    else report.context.push("HPL belum dicatat");
    const contractions = rowsFor("contractions"), done = contractions.filter(r => value(r.end) && r.end >= r.at && r.end <= now);
    const kicks = rowsFor("kicks"), completed = kicks.filter(r => r.done && value(r.last) && r.last >= r.at && r.last <= now);
    const symptoms = rowsFor("symptoms");
    report.summary = [`Kontraksi: ${done.length} selesai; ${contractions.length - done.length} belum selesai / durasi tidak tersedia. Rata-rata durasi: ${done.length ? durationLabel(done.reduce((n, r) => n + r.end - r.at, 0) / done.length) : "tidak tersedia"}.`, `Hitung gerakan: ${completed.length} sesi selesai; ${kicks.length - completed.length} sesi belum selesai / durasi tidak tersedia.`, `Gejala: ${symptoms.length} catatan pada ${categoryCount(symptoms)} hari.`];
    const last = done.at(-1);
    const group = last ? done.filter(r => r.at >= last.at - PATTERN_WINDOW_MS) : [];
    report.summary.push(group.length >= 2 ? `Kelompok kontraksi terakhir (${fullDate(group[0].at)} ${time(group[0].at)} - ${time(last!.at)}): ${group.length} kontraksi; rata-rata jarak awal-ke-awal ${durationLabel((last!.at - group[0].at) / (group.length - 1))}.` : "Jarak kontraksi: belum tersedia; perlu minimal dua kontraksi selesai dalam kelompok 10 menit terakhir yang berakhir pada catatan kontraksi selesai terbaru.");
    const names = [...new Set(symptoms.map(r => String(r.name || "Gejala tanpa nama")))];
    report.tables.push({ title: "Gejala yang dicatat", columns: ["Gejala", "Catatan", "Hari kemunculan"], widths: [55, 22, 97], numeric: [1], rows: names.map(name => { const rs = symptoms.filter(r => String(r.name || "Gejala tanpa nama") === name); return [name, String(rs.length), [...new Set(rs.map(r => fullDate(r.at)))].join(", ")]; }).sort((a, b) => Number(b[1]) - Number(a[1])) });
    report.tables.push({ title: "Sesi hitung gerakan", columns: ["Tanggal / jam", "Gerakan tercatat", "Status / durasi"], widths: [48, 43, 83], numeric: [1], rows: kicks.map(r => [`${fullDate(r.at)} ${time(r.at)}`, String(r.count ?? "Tidak dicatat"), completed.includes(r) ? `Selesai / ${durationLabel(r.last - r.at)}` : "Belum selesai / durasi tidak tersedia"]) });
  }
  report.details.rows = items.map(({ kind, r }) => {
    let text: string;
    if (kind === "contractions") text = `Kontraksi / ${value(r.end) && r.end >= r.at && r.end <= now ? durationLabel(r.end - r.at) : "Belum selesai / durasi tidak tersedia"}`;
    else if (kind === "kicks") text = `Hitung gerakan / ${r.count ?? "Tidak dicatat"} gerakan / ${r.done && value(r.last) && r.last >= r.at && r.last <= now ? `selesai dalam ${durationLabel(r.last - r.at)}` : "belum selesai / durasi tidak tersedia"}`;
    else if (kind === "symptoms") text = `Gejala / ${r.name || "Tanpa nama"}`;
    else { text = `${({ bottle: "Susu botol", breast: "Menyusu langsung", pump: "Pumping", diaper: "Ganti popok" })[kind]} / ${kind === "bottle" && !value(r.ml) ? "Volume tidak dicatat" : description({ ...r, at: r.at as number, kind } as Entry)}`; if (kind === "bottle" && r.offeredMl != null) text += ` / ditawarkan ${r.offeredMl} ml, sisa ${r.remainingMl ?? "tidak dicatat"} ml`; }
    return [`${fullDate(r.at)}\n${time(r.at)}`, `${text}${r.note ? `\n${r.note}` : ""}`];
  });
  return report;
}
function categoryCount(rs: Rec[]) { return new Set(rs.map(r => todayISO(new Date(r.at)))).size; }
