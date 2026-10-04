import { useSyncExternalStore } from "react";

/** Local-first data. Every record syncs by id with last-write-wins on updatedAt; deletes are tombstones. */
export type Collection =
  | "settings" | "contractions" | "kicks" | "symptoms" | "bag"
  | "bottle" | "breast" | "pump" | "diaper" | "wishlist";
export type Rec = { id: string; updatedAt: number; deleted?: boolean; updatedBy?: string; [k: string]: any };
type DB = Partial<Record<Collection, Record<string, Rec>>>;

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
  const id = rec.id ?? uid();
  const prev = db[col]?.[id];
  const next = { ...prev, ...rec, id, updatedAt: Math.max(Date.now(), (prev?.updatedAt ?? 0) + 1), deleted: false };
  db = { ...db, [col]: { ...db[col], [id]: next } };
  dirty.add(`${col}/${id}`);
  commit(true);
  return next as Rec;
}

export function remove(col: Collection, id: string) {
  const prev = db[col]?.[id];
  if (!prev) return;
  db = { ...db, [col]: { ...db[col], [id]: { id, updatedAt: Math.max(Date.now(), prev.updatedAt + 1), deleted: true } } };
  dirty.add(`${col}/${id}`);
  commit(true);
}

export function get(col: Collection, id: string): Rec | undefined {
  const r = db[col]?.[id];
  return r && !r.deleted ? r : undefined;
}

export function list(col: Collection, now = Date.now()): Rec[] {
  const all = Object.values(db[col] ?? {}).filter((r) => !r.deleted);
  const visible = THIN.includes(col) ? all.filter((r) => typeof r.at !== "number" || r.at >= now - FREE_WINDOW_MS) : all;
  return visible.sort((a, b) => (b.at ?? b.updatedAt) - (a.at ?? a.updatedAt));
}

/** Changes waiting to be pushed. */
export function pending() {
  return [...dirty].flatMap((key) => {
    const [collection, id] = key.split("/") as [Collection, string];
    const r = db[collection]?.[id];
    if (!r) return [];
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
  return JSON.stringify({ app: "BumpBuddy", exportedAt: new Date().toISOString(), data: db }, null, 2);
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
/** Re-renders on any data change; read with list()/get() inside the component. */
export const useDB = () => useSyncExternalStore(subscribe, () => version);

// Synced settings live in one record so birthMode/HPL resolve by LWW as a unit.
export type Settings = { hpl?: string; birthMode?: "pregnant" | "postpartum"; babyName?: string; babyBirth?: string };
export const settings = (): Settings => (get("settings", "main") ?? {}) as Settings;
export const saveSettings = (s: Settings) => put("settings", { ...settings(), ...s, id: "main" });

// Device-only preferences (not synced).
export type Prefs = {
  name?: string;
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
