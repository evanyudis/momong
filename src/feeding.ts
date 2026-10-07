import { todayISO } from "./dates";

export const localDateTime = (at: number) => {
  const d = new Date(at);
  return `${todayISO(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

type Fields = { at: number; ml: string; remaining: string; milk: string; side: string; minutes: string; type: string };
export function feedingDetails(kind: "bottle" | "breast" | "pump" | "diaper", f: Fields, now = Date.now()) {
  if (!Number.isFinite(f.at) || f.at < 0 || f.at > now) throw new Error("Pilih waktu mulai yang valid, tidak melebihi waktu sekarang.");
  const volume = (value: string) => value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 500;
  if (kind === "bottle") {
    if (!volume(f.ml) || Number(f.ml) <= 0) throw new Error("Isi jumlah ditawarkan antara 1–500 ml.");
    if (!volume(f.remaining) || Number(f.remaining) > Number(f.ml)) throw new Error("Sisa susu harus antara 0 ml dan jumlah ditawarkan.");
    if (!["formula", "expressed"].includes(f.milk)) throw new Error("Pilih jenis susu.");
    const offeredMl = Number(f.ml), remainingMl = Number(f.remaining);
    return { at: f.at, offeredMl, remainingMl, ml: Math.round((offeredMl - remainingMl) * 1000) / 1000, milk: f.milk };
  }
  if (kind === "breast" || kind === "pump") {
    if (!["left", "right", "both"].includes(f.side)) throw new Error("Pilih sisi payudara.");
    if (kind === "pump") {
      if (f.ml !== "" && !volume(f.ml)) throw new Error("Isi hasil pumping antara 0–500 ml, atau kosongkan.");
      // Null clears a previously recorded volume through JSON sync and backups.
      return { at: f.at, side: f.side, ml: f.ml === "" ? null : Number(f.ml) };
    }
    if (!f.minutes.trim() || !Number.isFinite(Number(f.minutes)) || Number(f.minutes) < 0 || Number(f.minutes) > 1440)
      throw new Error("Isi durasi antara 0–1440 menit.");
    return { at: f.at, side: f.side, minutes: Number(f.minutes) };
  }
  if (!["pee", "poo", "both"].includes(f.type)) throw new Error("Pilih jenis popok.");
  return { at: f.at, type: f.type };
}

export function durationMinutes(value: string) {
  const match = /^(\d{1,4}):([0-5]\d)$/.exec(value.trim());
  if (!match) throw new Error("Gunakan format menit:detik, misalnya 05:30.");
  const seconds = Number(match[1]) * 60 + Number(match[2]);
  if (seconds > 86400) throw new Error("Durasi maksimal 1440:00 (24 jam).");
  return String(seconds / 60);
}

export function normalizePumpTags(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 10 || value.some(t => typeof t !== "string" || !t.trim() || t.trim().length > 40))
    throw new Error("Gunakan maksimal 10 tag, masing-masing hingga 40 karakter.");
  return value.map(t => t.trim()).filter((t, i, all) => all.findIndex(v => v.toLocaleLowerCase() === t.toLocaleLowerCase()) === i);
}
