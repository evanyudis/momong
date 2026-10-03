import { useSyncExternalStore } from "react";
import { applyRemote, markAllDirty, markPushed, onLocalChange, pending } from "./store";

/** Public API base URL only. Secrets never live in this client. */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export type Member = { id: string; email: string; name: string; role: "owner" | "member" };
export type Me = {
  user: { id: string; email: string; name: string };
  entitlement: { plan: "free" | "trial" | "monthly" | "lifetime"; expiresAt: string | null };
  household: { id: string; seats: number; members: Member[] };
};
export type SyncStatus = "local" | "offline" | "syncing" | "synced" | "error";
type State = { token: string | null; me: Me | null; status: SyncStatus; lastSyncAt: number | null; error?: string };

const load = <T,>(k: string, d: T): T => {
  try { return JSON.parse(localStorage.getItem(k) ?? "") ?? d; } catch { return d; }
};
let state: State = {
  token: localStorage.getItem("bb_token"),
  me: load<Me | null>("bb_me", null),
  status: "local",
  lastSyncAt: load<number | null>("bb_last_sync", null),
};
const listeners = new Set<() => void>();
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  if (state.token) localStorage.setItem("bb_token", state.token); else localStorage.removeItem("bb_token");
  localStorage.setItem("bb_me", JSON.stringify(state.me));
  localStorage.setItem("bb_last_sync", JSON.stringify(state.lastSyncAt));
  listeners.forEach((l) => l());
}
export const useAccount = () =>
  useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
export const account = () => state;

export class ApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<{ data: T; res: Response }> {
  if (!API_URL) throw new ApiError(0, "no_api");
  const res = await fetch(API_URL + path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(state.token ? { authorization: `Bearer ${state.token}` } : {}),
      ...init.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && state.token) set({ token: null, me: null, status: "local" });
  if (!res.ok) throw new ApiError(res.status, data?.error ?? data?.code ?? "request_failed");
  return { data, res };
}

export async function requestMagicLink(email: string) {
  await api("/api/auth/sign-in/magic-link", { method: "POST", body: JSON.stringify({ email }) });
}

export async function verifyMagicLink(token: string) {
  const { data, res } = await api<{ token: string }>(`/api/auth/magic-link/verify?token=${encodeURIComponent(token)}`);
  set({ token: res.headers.get("set-auth-token") ?? data.token });
  await refreshMe();
  localStorage.removeItem("bb_cursor");
  markAllDirty();
  void syncNow();
}

export async function refreshMe() {
  const { data } = await api<Me>("/me");
  set({ me: data });
  return data;
}

export async function signOut() {
  await api("/api/auth/sign-out", { method: "POST", body: "{}" }).catch(() => {});
  localStorage.removeItem("bb_cursor");
  set({ token: null, me: null, status: "local", lastSyncAt: null });
}

export async function createInvite() {
  const { data } = await api<{ token: string; url: string; expiresAt: string }>("/household/invite", { method: "POST", body: "{}" });
  return data;
}

export async function joinHousehold(token: string) {
  await api("/household/join", { method: "POST", body: JSON.stringify({ token }) });
  localStorage.removeItem("bb_cursor");
  markAllDirty();
  await refreshMe();
  await syncNow();
}

export async function removeMember(id: string) {
  await api(`/household/members/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (id === state.me?.user.id) localStorage.removeItem("bb_cursor");
  await refreshMe();
}

let inFlight: Promise<void> | null = null;
export function syncNow(): Promise<void> {
  if (!state.token || !API_URL) return Promise.resolve();
  if (!navigator.onLine) { set({ status: "offline" }); return Promise.resolve(); }
  inFlight ??= (async () => {
    set({ status: "syncing" });
    try {
      const changes = pending();
      const since = Number(localStorage.getItem("bb_cursor") ?? 0);
      const { data } = await api<{ cursor: number; changes: any[] }>("/sync", {
        method: "POST",
        body: JSON.stringify({ since, changes }),
      });
      markPushed(changes);
      applyRemote(data.changes);
      // ponytail: second request per sync so partner joins/leaves show up; fold into /sync if traffic matters.
      await refreshMe().catch(() => {});
      localStorage.setItem("bb_cursor", String(data.cursor));
      set({ status: "synced", lastSyncAt: Date.now(), error: undefined });
    } catch (e) {
      set({ status: navigator.onLine ? "error" : "offline", error: (e as Error).message });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

let timer: ReturnType<typeof setTimeout> | undefined;
export function startSync() {
  onLocalChange(() => { clearTimeout(timer); timer = setTimeout(syncNow, 1500); });
  window.addEventListener("online", () => void syncNow());
  window.addEventListener("offline", () => state.token && set({ status: "offline" }));
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void syncNow());
  setInterval(() => document.visibilityState === "visible" && void syncNow(), 60_000);
  if (state.token) { void refreshMe().catch(() => {}); void syncNow(); }
}
