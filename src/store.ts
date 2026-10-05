import { midnight, todayISO } from "./dates";
import type { Reminder } from "./reminders";
import { useSyncExternalStore } from "react";

/** Local-first data. Every record syncs by id with last-write-wins on updatedAt; deletes are tombstones. */
export type Collection =
  | "baby" | "settings" | "contractions" | "kicks" | "symptoms" | "bag"
  | "bottle" | "breast" | "pump" | "diaper" | "wishlist";
export type Rec = { id: string; updatedAt: number; deleted?: boolean; updatedBy?: string; [k: string]: any };
type DB = Partial<Record<Collection, Record<string, Rec>>>;

const SCOPED: Collection[] = ["contractions", "kicks", "symptoms", "bag", "bottle", "breast", "pump", "diaper", "wishlist"];
let plusAccess = false;
export const isPlus = () => plusAccess;
export function setPlusAccess(value: boolean) {
  if (plusAccess === value) return;
  plusAccess = value;
  version++;
  listeners.forEach((l) => l());
}
export const activeBabyId = () => plusAccess ? prefs.activeBabyId ?? "default" : "default";
const recordId = (col: Collection, id: string) => col === "bag" && activeBabyId() !== "default" && !id.startsWith(`${activeBabyId()}:`) ? `${activeBabyId()}:${id}` : id;

const DB_KEY = "bb_db_v1";
const DIRTY_KEY = "bb_dirty_v1";
// PRD: ASI / pump / diaper keep 30 days of history on Free. Older entries are hidden, never deleted.
export const THIN: Collection[] = ["breast", "pump", "diaper"];
export const FREE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const read = <T,>(k: string, d: T): T => {
  try { return JSON.parse(localStorage.getItem(k) ?? "") ?? d; } catch { return d; }
};
let db: DB = read<DB>(DB_KEY, {});
let dirty = new Set<string>(read<string[]>(DIRTY_KEY, []));
let version = 0;
const listeners = new Set<() => void>();
const onChangeHooks = new Set<() => void>();

function commit(local: boolean) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  localStorage.setItem(DIRTY_KEY, JSON.stringify([...dirty]));
  version++;
  listeners.forEach((l) => l());
  if (local) onChangeHooks.forEach((h) => h());
}

export const onLocalChange = (fn: () => void) => { onChangeHooks.add(fn); return () => onChangeHooks.delete(fn); };
export const uid = () => crypto.randomUUID();

export function put(col: Collection, rec: Omit<Rec, "updatedAt"> & { id?: string }) {
  const id = recordId(col, rec.id ?? uid());
  const babyId = SCOPED.includes(col) ? { babyId: activeBabyId() } : {};
  const prev = db[col]?.[id];
  const next = { ...babyId, ...prev, ...rec, id, updatedAt: Math.max(Date.now(), (prev?.updatedAt ?? 0) + 1), deleted: false };
  db = { ...db, [col]: { ...db[col], [id]: next } };
  dirty.add(`${col}/${id}`);
  commit(true);
  return next as Rec;
}

export function remove(col: Collection, id: string) {
  id = recordId(col, id);
  const prev = db[col]?.[id];
  if (!prev) return;
  db = { ...db, [col]: { ...db[col], [id]: { id, updatedAt: Math.max(Date.now(), prev.updatedAt + 1), deleted: true, ...(prev.babyId ? { babyId: prev.babyId } : {}) } } };
  dirty.add(`${col}/${id}`);
  commit(true);
}

export function get(col: Collection, id: string): Rec | undefined {
  id = recordId(col, id);
  const r = db[col]?.[id];
  return r && !r.deleted ? r : undefined;
}

export function list(col: Collection, now = Date.now()): Rec[] {
  const all = Object.values(db[col] ?? {}).filter((r) => !r.deleted && (!SCOPED.includes(col) || (r.babyId ?? "default") === activeBabyId()));
  const visible = !plusAccess && THIN.includes(col) ? all.filter((r) => typeof r.at !== "number" || r.at >= now - FREE_WINDOW_MS) : all;
  return visible.sort((a, b) => (b.at ?? b.updatedAt) - (a.at ?? a.updatedAt));
}

/** True when the Free window is hiding older ASI / pump / diaper entries (history is truncated). */
export const hasHidden = (now = Date.now()) =>
  !plusAccess && THIN.some((col) => Object.values(db[col] ?? {}).some((r) => !r.deleted && (r.babyId ?? "default") === activeBabyId() && typeof r.at === "number" && r.at < now - FREE_WINDOW_MS));

/** Changes waiting to be pushed. */
export function pending() {
  return [...dirty].flatMap((key) => {
    const [collection, id] = key.split("/") as [Collection, string];
    const r = db[collection]?.[id];
    if (!r || !plusAccess && (collection === "baby" || SCOPED.includes(collection) && (r.babyId ?? "default") !== "default")) return [];
    const { id: _id, updatedAt, deleted, updatedBy: _by, ...data } = r;
    return [{ collection, id, updatedAt, deleted: !!deleted, data: deleted ? null : data }];
  });
}

export function markPushed(keys: { collection: string; id: string; updatedAt: number }[]) {
  for (const k of keys) {
    // Only clear if the record wasn't edited again while the request was in flight.
    if (db[k.collection as Collection]?.[k.id]?.updatedAt === k.updatedAt) dirty.delete(`${k.collection}/${k.id}`);
  }
  commit(false);
}

/** After joining a household, everything local goes up again so both phones merge. */
export function markAllDirty() {
  for (const [col, recs] of Object.entries(db)) for (const id of Object.keys(recs ?? {})) dirty.add(`${col}/${id}`);
  commit(false);
}

export type RemoteChange = { collection: string; id: string; data: any; deleted: boolean; updatedAt: number; updatedBy?: string };

export function applyRemote(changes: RemoteChange[]) {
  if (!changes.length) return;
  for (const ch of changes) {
    const col = ch.collection as Collection;
    const local = db[col]?.[ch.id];
    if (local && local.updatedAt >= ch.updatedAt) continue;
    const rec: Rec = ch.deleted
      ? { id: ch.id, updatedAt: ch.updatedAt, deleted: true }
      : { ...ch.data, id: ch.id, updatedAt: ch.updatedAt, updatedBy: ch.updatedBy };
    db = { ...db, [col]: { ...db[col], [ch.id]: rec } };
    dirty.delete(`${col}/${ch.id}`);
  }
  commit(false);
}

export function exportJSON() {
  return JSON.stringify({ app: "Momong", version: 2, exportedAt: new Date().toISOString(), data: db, preferences: { name: prefs.name, theme: prefs.theme, activeBabyId: prefs.activeBabyId, reminders: prefs.reminders } }, null, 2);
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
/** Re-renders on any data change; read with list()/get() inside the component. */
export const useDB = () => useSyncExternalStore(subscribe, () => version);

// Synced settings live in one record so birthMode/HPL resolve by LWW as a unit.
export type Settings = { hpl?: string; birthMode?: "pregnant" | "postpartum"; babyName?: string; babyBirth?: string };
export const settings = (): Settings => ((activeBabyId() === "default" ? get("settings", "main") : get("baby", activeBabyId())) ?? {}) as Settings;
export const saveSettings = (s: Settings) => activeBabyId() === "default" ? put("settings", { ...settings(), ...s, id: "main" }) : put("baby", { ...settings(), ...s, id: activeBabyId() });
export const babyProfiles = () => [{ ...get("settings", "main"), id: "default", babyName: get("settings", "main")?.babyName || "Si kecil" }, ...list("baby")];
export function addBaby(s: Settings) {
  const date = s.birthMode === "pregnant" ? s.hpl : s.babyBirth;
  if (!plusAccess || !s.babyName?.trim() || s.babyName.length > 120 || (s.birthMode !== "pregnant" && s.birthMode !== "postpartum") ||
    !date || todayISO(new Date(midnight(date))) !== date || s.birthMode === "postpartum" && date > todayISO()) return false;
  const r = put("baby", s);
  setPrefs({ activeBabyId: r.id });
  return true;
}

// Device-only preferences (not synced).
export type Prefs = {
  name?: string;
  guest?: boolean;
  activeBabyId?: string;
  reminders?: Reminder[];
  notifyReminders?: boolean;
  theme?: "light" | "dark" | "system";
  // Contraction pattern alert dismissals (device only).
  criticalDismissedAt?: number;
  warningDismissedFor?: string;
};
const PREFS_KEY = "bb_prefs_v1";
let prefs: Prefs = read<Prefs>(PREFS_KEY, {});
export const getPrefs = () => prefs;
export function setPrefs(p: Prefs) {
  prefs = { ...prefs, ...p };
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  version++;
  listeners.forEach((l) => l());
}

/** Device reset only: no tombstones and no upload notification. */
export function resetDeviceData() {
  for (const storage of [localStorage, sessionStorage]) {
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
    for (const key of keys) if (key?.startsWith("bb_")) storage.removeItem(key);
  }
  db = {}; dirty.clear(); prefs = {}; plusAccess = false;
  version++;
  listeners.forEach((l) => l());
}

export type Backup = { data: DB; preferences: Prefs; records: number };
export const deviceHasData = () => Object.values(db).some((rows) => Object.keys(rows ?? {}).length > 0);
const collections: Collection[] = ["baby", "settings", "contractions", "kicks", "symptoms", "bag", "bottle", "breast", "pump", "diaper", "wishlist"];
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
export function parseBackup(text: string): Backup {
  if (new Blob([text]).size > 5 * 1024 * 1024) throw new Error("File terlalu besar. Maksimal 5 MiB.");
  let value: any;
  try { value = JSON.parse(text); } catch { throw new Error("File bukan JSON yang valid."); }
  if (!object(value) || !["Momong", "BumpBuddy"].includes(value.app) || !object(value.data) || value.version !== undefined && value.version !== 2)
    throw new Error("Format cadangan tidak didukung.");
  let records = 0;
  for (const [col, rows] of Object.entries(value.data)) {
    if (!collections.includes(col as Collection) || !object(rows)) throw new Error("Koleksi cadangan tidak valid.");
    for (const [id, row] of Object.entries(rows)) {
      if (!object(row) || row.id !== id || !id || id.includes("/") || !Number.isFinite(row.updatedAt) || row.updatedAt < 0 ||
        row.deleted !== undefined && typeof row.deleted !== "boolean" ||
        row.babyId !== undefined && typeof row.babyId !== "string" ||
        row.at !== undefined && !Number.isFinite(row.at))
        throw new Error("Catatan cadangan tidak valid.");
      for (const [key, field] of Object.entries(row)) {
        if (["__proto__", "constructor", "prototype"].includes(key) || field !== null && !["string", "number", "boolean"].includes(typeof field) ||
          typeof field === "number" && !Number.isFinite(field) || typeof field === "string" && field.length > 10000)
          throw new Error("Isi catatan cadangan tidak valid.");
      }
      if (["settings", "baby"].includes(col)) {
        for (const date of [row.hpl, row.babyBirth]) if (date !== undefined && (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(midnight(date)) || todayISO(new Date(midnight(date))) !== date))
          throw new Error("Tanggal profil cadangan tidak valid.");
        if (row.birthMode !== undefined && !["pregnant", "postpartum"].includes(row.birthMode)) throw new Error("Mode profil cadangan tidak valid.");
      }
      for (const key of ["babyName", "name", "note", "label", "type", "side", "milk"]) if (row[key] !== undefined && typeof row[key] !== "string")
        throw new Error("Isi catatan cadangan tidak valid.");
      for (const key of ["checked", "custom", "have", "done"]) if (row[key] !== undefined && typeof row[key] !== "boolean") throw new Error("Status catatan cadangan tidak valid.");
      for (const key of ["count", "minutes", "ml", "end", "last", "interval"]) if (row[key] !== undefined && (!Number.isFinite(row[key]) || row[key] < 0))
        throw new Error("Angka catatan cadangan tidak valid.");
      records++;
    }
  }
  const preferences: Prefs = {};
  if (value.version === 2) {
    const p = value.preferences;
    if (!object(p)) throw new Error("Preferensi cadangan tidak valid.");
    if (p.name !== undefined) {
      if (typeof p.name !== "string" || p.name.length > 120) throw new Error("Nama cadangan tidak valid.");
      preferences.name = p.name;
    }
    if (p.theme !== undefined) {
      if (!["light", "dark", "system"].includes(p.theme)) throw new Error("Tema cadangan tidak valid.");
      preferences.theme = p.theme;
    }
    if (p.activeBabyId !== undefined) {
      if (typeof p.activeBabyId !== "string" || p.activeBabyId !== "default" && !value.data.baby?.[p.activeBabyId]) throw new Error("Profil bayi cadangan tidak ditemukan.");
      preferences.activeBabyId = p.activeBabyId;
    }
    if (p.reminders !== undefined) {
      if (!Array.isArray(p.reminders) || p.reminders.some((r: any) => !object(r) || typeof r.id !== "string" ||
        typeof r.babyId !== "string" || typeof r.label !== "string" || r.label.length > 120 ||
        !Number.isFinite(r.at) || r.firedAt !== undefined && !Number.isFinite(r.firedAt))) throw new Error("Pengingat cadangan tidak valid.");
      preferences.reminders = p.reminders.map((r: Reminder) => ({ id: r.id, babyId: r.babyId, label: r.label, at: r.at, ...(r.firedAt === undefined ? {} : { firedAt: r.firedAt }) }));
    }
  }
  return { data: value.data, preferences, records };
}
export function restoreBackup(backup: Backup) {
  if (localStorage.getItem("bb_token")) throw new Error("Keluar akun sebelum memulihkan cadangan.");
  if (deviceHasData()) throw new Error("Perangkat sudah berisi data. Pemulihan tidak boleh menimpa catatan.");
  const valid = parseBackup(JSON.stringify({ app: "Momong", version: 2, data: backup.data, preferences: backup.preferences }));
  const nextDirty = Object.entries(valid.data).flatMap(([col, rows]) => Object.keys(rows ?? {}).map((id) => `${col}/${id}`));
  const nextPrefs = { ...valid.preferences, guest: true };
  const writes = [[DB_KEY, JSON.stringify(valid.data)], [DIRTY_KEY, JSON.stringify(nextDirty)], [PREFS_KEY, JSON.stringify(nextPrefs)]];
  const previous = writes.map(([key]) => [key!, localStorage.getItem(key!)] as const);
  try { for (const [key, value] of writes) localStorage.setItem(key!, value!); }
  catch {
    for (const [key, value] of previous) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }
    throw new Error("Penyimpanan perangkat penuh. Cadangan belum dipulihkan.");
  }
  db = valid.data; dirty = new Set(nextDirty); prefs = nextPrefs;
  version++; listeners.forEach((l) => l());
}
