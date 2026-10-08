import { Baby, Milk, Droplet, Square } from "lucide-react";
import { babyAge, isToday, todayISO, timeLabel } from "./dates";
export type Kind = "bottle" | "breast" | "pump" | "diaper";
export type Entry = { id: string; kind: Kind; at: number; ml?: number | null; offeredMl?: number; remainingMl?: number; minutes?: number; milk?: string; side?: string; type?: string; tags?: string[] };
export function totals(entries: Entry[], now = new Date()) {
  const today = entries.filter(e => isToday(e.at, now));
  return [today.filter(e => e.kind === "bottle").reduce((n,e) => n + (e.ml ?? 0), 0), today.filter(e => e.kind === "breast").length, today.filter(e => e.kind === "pump").reduce((n,e) => n + (e.ml ?? 0), 0), today.filter(e => e.kind === "diaper").length];
}
export const clock = (ms: number) => `${String(Math.floor(Math.max(0,ms) / 60000)).padStart(2,"0")}:${String(Math.floor(Math.max(0,ms) / 1000) % 60).padStart(2,"0")}`;

export function newbornAgeLabel(birth: string, today = new Date()) {
  const [year, month, day] = birth.split("-").map(Number);
  let months = (today.getFullYear() - year) * 12 + today.getMonth() - (month - 1);
  const anniversaryDay = Math.min(day, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate());
  if (today.getDate() < anniversaryDay) months--;
  months = Math.max(0, months);
  const years = Math.floor(months / 12), remaining = months % 12;
  const anchorMonth = month - 1 + months;
  const anchor = new Date(year, anchorMonth, Math.min(day, new Date(year, anchorMonth + 1, 0).getDate()));
  const days = Math.max(0, Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())) / 86400000));
  const calendarAge = years ? `${years} tahun${remaining ? ` ${remaining} bulan` : ""}` : months ? `${months} bulan` : "";
  return `${babyAge(birth, today).weeks} minggu · ${calendarAge}${days || !calendarAge ? `${calendarAge ? " " : ""}${days} hari` : ""}`;
}

export function shiftDay(date:string, amount:number) {
 const [y,m,d]=date.split("-").map(Number);
 return todayISO(new Date(y,m-1,d+amount));
}
export function entriesOnDate(entries:Entry[],date:string) {
 return entries.filter(e=>todayISO(new Date(e.at))===date).sort((a,b)=>a.at-b.at);
}
export function agendaTime(entry:Entry) {
 const start=timeLabel(entry.at);
 return (entry.kind==="breast"||entry.kind==="pump")&&entry.minutes!=null&&entry.minutes>0 ? `${start}–${timeLabel(entry.at+entry.minutes*60000)}` : start;
}

export const kinds = [{kind:"bottle",label:"Minum susu",Icon:Milk},{kind:"breast",label:"Menyusu langsung",Icon:Baby},{kind:"pump",label:"Pumping",Icon:Droplet},{kind:"diaper",label:"Ganti popok",Icon:Square}] as const;
export function description(e:Entry) {
 const side = e.side === "left" ? "Kiri" : e.side === "right" ? "Kanan" : e.side === "both" ? (e.kind === "pump" ? "Keduanya" : "Bergantian") : "Sisi tidak dicatat";
 return e.kind === "bottle" ? `${e.ml} ml · ${e.milk === "formula" ? "Formula" : "ASI perah"}` : e.kind === "breast" ? `${clock((e.minutes ?? 0) * 60000)} · ${side}` : e.kind === "pump" ? `${e.ml == null ? "Tanpa volume" : `${e.ml} ml`} · ${side}${e.tags?.length ? ` · ${e.tags.join(", ")}` : ""}` : e.type === "pee" ? "Pipis" : e.type === "poo" ? "Pup" : "Pipis & pup";
}
