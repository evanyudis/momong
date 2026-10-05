import { useSyncExternalStore } from "react";
import { nameFromEmail, type SignInMode } from "./signin";
import { setPlusAccess, isPlus, applyRemote, markAllDirty, markPushed, onLocalChange, pending, resetDeviceData } from "./store";

/** Public API base URL only. Secrets never live in this client.
 *  Production calls its own origin (empty base); Vercel rewrites API paths to the server, so HTTPS never fetches HTTP. */
export const API_URL = import.meta.env?.PROD ? "" : (import.meta.env?.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
export const HAS_API = import.meta.env?.PROD || !!API_URL;

export type Member = { id: string; email: string; name: string; role: "owner" | "member" };
export type Me = {
  user: { id: string; email: string; name: string };
  entitlement: { plan: "free" | "trial" | "monthly" | "plus_lifetime"; expiresAt: string | null };
  household: { id: string; seats: number; members: Member[] };
};
export type SyncStatus = "local" | "offline" | "syncing" | "synced" | "error";
type State = { token: string | null; me: Me | null; status: SyncStatus; lastSyncAt: number | null; hasSynced: boolean; syncEnabled: boolean; error?: string };

const load = <T,>(k: string, d: T): T => {
  try { return JSON.parse(localStorage.getItem(k) ?? "") ?? d; } catch { return d; }
};
let state: State = {
  token: localStorage.getItem("bb_token"),
  me: load<Me | null>("bb_me", null),
  status: "local",
  lastSyncAt: load<number | null>("bb_last_sync", null),
  hasSynced: false,
  syncEnabled: false,
};
const entitled = (me: Me | null) => me?.entitlement.plan === "plus_lifetime" || ((me?.entitlement.plan === "trial" || me?.entitlement.plan === "monthly") && !!me.entitlement.expiresAt && Date.parse(me.entitlement.expiresAt) > Date.now());
setPlusAccess(!!state.token && entitled(state.me));
let sessionVersion = 0;
let syncVersion = 0;
const listeners = new Set<() => void>();
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  const plus = !!state.token && entitled(state.me);
  if (plus && !isPlus()) { localStorage.removeItem("bb_cursor"); syncVersion++; }
  setPlusAccess(plus);
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

export async function api<T>(path: string, init: RequestInit = {}): Promise<{ data: T; res: Response }> {
  if (!HAS_API) throw new ApiError(0, "no_api");
  const version = sessionVersion;
  const res = await fetch(API_URL + path, {
    ...init,
    headers: { "content-type": "application/json", ...(state.token ? { authorization: `Bearer ${state.token}` } : {}), ...init.headers },
  });
  const data = await res.json().catch(() => { if (res.ok) throw new ApiError(502, "invalid_response"); return {}; });
  if (version !== sessionVersion) throw new ApiError(0, "session_changed");
  if (res.status === 401 && state.token) clearSession();
  if (!res.ok) throw new ApiError(res.status, data?.error ?? data?.code ?? "request_failed");
  return { data, res };
}

export function authDestination(fallback = "#/profil") {
  const target = sessionStorage.getItem("bb_auth_return");
  sessionStorage.removeItem("bb_auth_return");
  return target === "#/plus" || target === "#/pasangan" ? target : fallback;
}

function clearSession() {
  sessionVersion++;
  syncVersion++;
  clearTimeout(timer);
  localStorage.removeItem("bb_cursor");
  set({ token: null, me: null, status: "local", lastSyncAt: null, hasSynced: false, syncEnabled: false, error: undefined });
}

export function setSyncEnabled(enabled: boolean) {
  if (!state.me || !state.token) return;
  syncVersion++;
  localStorage.setItem(`bb_sync_enabled:${state.me.user.id}`, JSON.stringify(enabled));
  set({ syncEnabled: enabled, status: "local", hasSynced: false });
  if (enabled) {
    localStorage.removeItem("bb_cursor");
    markAllDirty();
    void syncNow();
  }
}

function establishSession(token?: string | null) {
  if (!token) throw new ApiError(502, "missing_session");
  sessionVersion++; syncVersion++;
  set({ token, me: null, syncEnabled: false, hasSynced: false, status: "local", lastSyncAt: null });
}

export async function requestMagicLink(email: string) {
  await api("/api/auth/sign-in/magic-link", { method: "POST", body: JSON.stringify({ email }) });
}

export async function verifyMagicLink(token: string) {
  const { data, res } = await api<{ token: string }>(`/api/auth/magic-link/verify?token=${encodeURIComponent(token)}`);
  establishSession(res.headers.get("set-auth-token") ?? data.token);
  await signedIn();
}

/** Better Auth email + password. Sign-up signs in at once; both hand the bearer back on set-auth-token. */
export async function authEmail(mode: SignInMode, email: string, password: string) {
  const path = mode === "daftar" ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email";
  const body = mode === "daftar" ? { name: nameFromEmail(email), email, password } : { email, password };
  const { data, res } = await api<{ token?: string }>(path, { method: "POST", body: JSON.stringify(body) });
  establishSession(res.headers.get("set-auth-token") ?? data.token);
  await signedIn();
}

/** Signed in means token and /me. No /me, no session: drop the token rather than half sign in. Sync stays opt-in. */
async function signedIn() {
  const version = sessionVersion;
  await refreshMe().catch((e) => { if (version === sessionVersion) clearSession(); throw e; });
  localStorage.removeItem("bb_cursor");
  set({ syncEnabled: load<boolean>(`bb_sync_enabled:${state.me!.user.id}`, false), status: "local" });
  if (state.syncEnabled) { markAllDirty(); void syncNow(); }
}

// Set while the browser is away at Google. Success returns to #/profil, cancel/deny to #/masuk-akun (errorCallbackURL).
const GOOGLE_AWAY = "bb_google";

/** Better Auth social sign-in: the API answers with Google's URL (and sets its OAuth state cookie on this origin), then we leave. */
export async function startGoogle() {
  const { data } = await api<{ url?: string }>("/api/auth/sign-in/social", {
    method: "POST",
    body: JSON.stringify({
      provider: "google",
      callbackURL: `${location.origin}/#/profil`,
      errorCallbackURL: `${location.origin}/#/masuk-akun`,
    }),
  });
  if (!data.url) throw new ApiError(502, "no_url");
  sessionStorage.setItem(GOOGLE_AWAY, "away");
  location.assign(data.url);
}

/** True once per Google round trip that came back without signing in; clears the marker. SignIn shows "Masuk Google dibatalkan". */
export function takeGoogleReturn() {
  const away = sessionStorage.getItem(GOOGLE_AWAY) === "away";
  if (away) sessionStorage.removeItem(GOOGLE_AWAY);
  return away;
}

/** Boot after Google: the callback left a Better Auth session cookie on this origin. Trade it for the bearer, then the email path.
 *  No session (cancelled, closed, denied): send them to the sign-in screen, which reads the marker and says so. */
export async function finishGoogle() {
  if (sessionStorage.getItem(GOOGLE_AWAY) !== "away") return;
  if (state.token) return sessionStorage.removeItem(GOOGLE_AWAY);
  if (location.hash.startsWith("#/masuk-akun")) return; // error landing: SignIn takes the marker itself
  sessionStorage.setItem(GOOGLE_AWAY, "finishing");
  try {
    const { data, res } = await api<{ session?: { token?: string } } | null>("/api/auth/get-session");
    const token = res.headers.get("set-auth-token") ?? data?.session?.token;
    if (!token) throw new ApiError(401, "no_session");
    establishSession(token);
    await signedIn();
    sessionStorage.removeItem(GOOGLE_AWAY);
    location.hash = authDestination();
  } catch {
    sessionStorage.setItem(GOOGLE_AWAY, "away");
    location.hash = "#/masuk-akun";
  }
}

export async function refreshMe() {
  const { data } = await api<Me>("/me");
  if (!data?.user?.id || typeof data.user.email !== "string" || typeof data.user.name !== "string" || !data.household?.id ||
    !Array.isArray(data.household.members) || !data.entitlement || !["free", "trial", "monthly", "plus_lifetime"].includes(data.entitlement.plan)) throw new ApiError(502, "invalid_account");
  set({ me: data });
  return data;
}

export async function signOut() {
  const token = state.token;
  sessionStorage.removeItem("bb_auth_return");
  sessionStorage.removeItem("bb_google");
  localStorage.removeItem("bb_pending_invite");
  clearSession();
  if (token && HAS_API && navigator.onLine) {
    await fetch(API_URL + "/api/auth/sign-out", {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: "{}",
    }).catch(() => {});
  }
}

export function resetGuestData() {
  if (state.token) return false;
  clearSession();
  resetDeviceData();
  return true;
}

export async function createInvite() {
  const { data } = await api<{ token: string; url: string; expiresAt: string }>("/household/invite", { method: "POST", body: "{}" });
  return data;
}

export async function joinHousehold(token: string) {
  if (!state.syncEnabled) throw new ApiError(409, "sync_disabled");
  syncVersion++;
  await api("/household/join", { method: "POST", body: JSON.stringify({ token }) });
  set({ hasSynced: false });
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
  if (!state.token || !state.syncEnabled || !HAS_API) return Promise.resolve();
  if (!navigator.onLine) { set({ status: "offline" }); return Promise.resolve(); }
  if (inFlight) return inFlight;
  const version = sessionVersion, syncing = syncVersion;
  const current = () => version === sessionVersion && syncing === syncVersion && state.syncEnabled;
  let more = false;
  inFlight = (async () => {
    set({ status: "syncing" });
    try {
      const changes = pending().slice(0, 1000);
      const since = Number(localStorage.getItem("bb_cursor") ?? 0);
      const { data } = await api<{ cursor: number; changes: any[]; hasMore?: boolean }>("/sync", {
        method: "POST",
        body: JSON.stringify({ since, changes }),
      });
      if (!current()) return;
      markPushed(changes);
      applyRemote(data.changes);
      // ponytail: second request per sync so partner joins/leaves show up; fold into /sync if traffic matters.
      await refreshMe().catch(() => {});
      if (!current()) return;
      localStorage.setItem("bb_cursor", String(data.cursor));
      set({ status: "synced", lastSyncAt: Date.now(), hasSynced: true, error: undefined });
      more = !!data.hasMore || pending().length > 0;
    } catch (e) {
      if (!current()) return;
      set({ status: navigator.onLine ? "error" : "offline", error: (e as Error).message });
    } finally {
      inFlight = null;
      if ((!current() || more) && state.syncEnabled && state.token) void syncNow();
    }
  })();
  return inFlight;
}

let timer: ReturnType<typeof setTimeout> | undefined;
export function startSync() {
  onLocalChange(() => { clearTimeout(timer); if (state.syncEnabled) timer = setTimeout(syncNow, 1500); });
  window.addEventListener("online", () => void syncNow());
  window.addEventListener("offline", () => state.syncEnabled && set({ status: "offline" }));
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void syncNow());
  setInterval(() => document.visibilityState === "visible" && void syncNow(), 60_000);
  if (state.token) void refreshMe().then(() => {
    set({ syncEnabled: load<boolean>(`bb_sync_enabled:${state.me!.user.id}`, false) });
    if (state.syncEnabled) void syncNow();
  }).catch(() => {});
}
