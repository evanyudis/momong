import { reportError } from "./telemetry";
import { useSyncExternalStore } from "react";
import { clearInvite, googleReturnAction, inviteReturnHash, isInviteToken, isSafeInviteReturn, navigationType, readInvite, reconcilePendingInvite } from "./invite";
import { PLUS_ENABLED } from "./release";
import { AUTH_ATTEMPT_KEY, AUTH_NOTICE_KEY, SIGNIN_DRAFT_KEY, controllerChangeAction, failureFor, nameFromEmail, parseAuthAttempt, signInRetryStep, signupStep, type SignInFailure, type SignInMode } from "./signin";
import { setPlusAccess, isPlus, applyRemote, clearAccountRecords, markAllDirty, markPushed, onLocalChange, pending, resetDeviceData, settings } from "./store";

/** Public API base URL only. Secrets never live in this client.
 *  Production calls its own origin (empty base); Vercel rewrites API paths to the server, so HTTPS never fetches HTTP. */
export const API_URL = import.meta.env?.PROD ? "" : (import.meta.env?.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
export const HAS_API = import.meta.env?.PROD || !!API_URL;

export type Member = { id: string; email: string; name: string; role: "owner" | "member" };
export type Me = {
  user: { id: string; email: string; name: string };
  entitlement: { plan: "free" | "trial" | "monthly" | "plus_lifetime"; expiresAt: string | null; earlyAccess?: boolean };
  household: { id: string; seats: number; members: Member[] };
};
export type SyncStatus = "local" | "offline" | "syncing" | "synced" | "error";
type State = { checking?: boolean; restoreError?: boolean; verifiedAt?: number; token: string | null; me: Me | null; status: SyncStatus; lastSyncAt: number | null; hasSynced: boolean; syncEnabled: boolean; error?: string };

const load = <T,>(k: string, d: T): T => {
  try { return JSON.parse(localStorage.getItem(k) ?? "") ?? d; } catch { return d; }
};
const DATA_USER = "bb_data_user";

function syncFlagKey(userId: string) {
  return `bb_sync_enabled:${userId}`;
}

function writeSyncEnabled(userId: string, enabled: boolean) {
  localStorage.setItem(syncFlagKey(userId), JSON.stringify(enabled));
}

function storedSyncEnabled(me: Me | null) {
  const userId = me?.user?.id;
  if (!userId) return false;
  const raw = localStorage.getItem(syncFlagKey(userId));
  if (raw === "true") return true;
  if (raw === "false") return false;
  const cursor = Number(localStorage.getItem("bb_cursor") ?? 0);
  return Number.isFinite(cursor) && cursor > 0;
}

/** Local notes belong to the account that wrote them. A different login starts clean. Sync flags stay. */
function adoptAccountData(userId: string) {
  const previous = localStorage.getItem(DATA_USER);
  if (previous && previous !== userId) clearAccountRecords();
  localStorage.setItem(DATA_USER, userId);
}

/** Cache Storage and IndexedDB can keep a previous account after a wipe. */
export function clearBrowserCaches() {
  const cacheStore = (globalThis as { caches?: { keys: () => Promise<string[]>; delete: (key: string) => Promise<boolean> } }).caches;
  if (cacheStore?.keys) {
    void Promise.resolve(cacheStore.keys()).then((keys) => Promise.all(keys.map((key) => cacheStore.delete(key)))).catch(() => {});
  }
  const idb = (globalThis as { indexedDB?: { databases?: () => Promise<{ name?: string | null }[]>; deleteDatabase: (name: string) => void } }).indexedDB;
  if (idb?.databases && idb.deleteDatabase) {
    void Promise.resolve(idb.databases()).then((dbs) => {
      for (const db of dbs) if (db?.name) idb.deleteDatabase(db.name);
    }).catch(() => {});
  }
}

const cachedMe = load<Me | null>("bb_me", null);
let state: State = {
  token: localStorage.getItem("bb_token"),
  me: cachedMe,
  status: "local",
  lastSyncAt: load<number | null>("bb_last_sync", null),
  hasSynced: false,
  syncEnabled: storedSyncEnabled(cachedMe),
};
export const entitled = (me: Me | null) => (PLUS_ENABLED || me?.entitlement.earlyAccess === true && (me.entitlement.plan === "trial" || me.entitlement.plan === "plus_lifetime")) && (me?.entitlement.plan === "plus_lifetime" || ((me?.entitlement.plan === "trial" || me?.entitlement.plan === "monthly") && !!me.entitlement.expiresAt && Date.parse(me.entitlement.expiresAt) > Date.now()));
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
  useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
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
  if (res.status >= 500) reportError(new Error("API server failure"), "api");
  if (!res.ok) throw new ApiError(res.status, data?.error ?? data?.code ?? "request_failed");
  return { data, res };
}

export function authDestination(fallback = "#/profil") {
  const target = sessionStorage.getItem("bb_auth_return");
  sessionStorage.removeItem("bb_auth_return");
  if (target === "#/plus" || target === "#/pasangan") return target;
  if (target && isSafeInviteReturn(target)) return target;
  const pending = readInvite();
  if (pending) return inviteReturnHash(pending);
  return fallback;
}

function clearSession() {
  sessionVersion++;
  syncVersion++;
  clearTimeout(timer);
  localStorage.removeItem("bb_cursor");
  set({ token: null, me: null, checking: false, restoreError: false, status: "local", lastSyncAt: null, hasSynced: false, syncEnabled: false, error: undefined });
}

export function setSyncEnabled(enabled: boolean) {
  if (!state.me || !state.token) return;
  syncVersion++;
  writeSyncEnabled(state.me.user.id, enabled);
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
  set({ token, me: null, checking: true, restoreError: false, syncEnabled: false, hasSynced: false, status: "local", lastSyncAt: null });
}

export async function requestMagicLink(email: string) {
  await api("/api/auth/sign-in/magic-link", { method: "POST", body: JSON.stringify({ email }) });
}

export async function verifyMagicLink(token: string) {
  const { data, res } = await api<{ token: string }>(`/api/auth/magic-link/verify?token=${encodeURIComponent(token)}`);
  establishSession(res.headers.get("set-auth-token") ?? data.token);
  await signedIn();
}

export const AUTH_TIMEOUT_MS = 15_000;

function isTimeout(error: unknown) {
  return !!error && typeof error === "object" && "name" in error && ((error as { name?: string }).name === "TimeoutError" || (error as { name?: string }).name === "AbortError");
}

type AuthResult = { id: number; status: number; failure: SignInFailure | null };
type AuthSnapshot = { pending: boolean; result: AuthResult | null };
const authListeners = new Set<() => void>();
let authResultId = 0;
function storedAuthAttempt() {
  try { return parseAuthAttempt(sessionStorage.getItem(AUTH_ATTEMPT_KEY)); } catch { return null; }
}
let authUiState: AuthSnapshot = { pending: !!storedAuthAttempt(), result: null };
let authSettled: (() => void) | null = null;

function publishAuth(pending: boolean, result: AuthResult | null) {
  authUiState = { pending, result };
  authListeners.forEach((listener) => listener());
}

export function authUi() { return authUiState; }
export function subscribeAuthUi(listener: () => void) {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}
export function authIsPending() { return authUiState.pending; }
export function onControllerChange() { return controllerChangeAction(authIsPending()); }
/** Main registers this so a deferred service-worker reload runs after the sign-up chain stores its result. */
export function whenAuthSettles(listener: () => void) { authSettled = listener; }

let authPassword: string | null = null;

function beginAuthAttempt(mode: SignInMode, email: string, password: string) {
  authPassword = password;
  sessionStorage.setItem(AUTH_ATTEMPT_KEY, JSON.stringify({ mode, email }));
  publishAuth(true, null);
}

function finishAuthAttempt(result: AuthResult | null) {
  authPassword = null;
  sessionStorage.removeItem(AUTH_ATTEMPT_KEY);
  publishAuth(false, result);
  const settled = authSettled;
  if (settled) queueMicrotask(settled);
}

/** Same-page remounts can refill the field. A reload cannot, because the password is not stored. */
export function authMemoryPassword() {
  return authPassword ?? "";
}

function assignHash(hash: string) {
  try { location.hash = hash; } catch { /* non-browser tests */ }
}

function publishCreatedLogin(email: string) {
  sessionStorage.setItem(SIGNIN_DRAFT_KEY, JSON.stringify({ mode: "masuk", email, failure: "created" }));
  sessionStorage.setItem(AUTH_NOTICE_KEY, "created");
  assignHash("#/masuk-akun");
}

async function postAuth(mode: SignInMode, email: string, password: string) {
  const path = mode === "daftar" ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email";
  const body = mode === "daftar" ? { name: nameFromEmail(email), email, password } : { email, password };
  try {
    return await api<{ token?: string }>(path, { method: "POST", body: JSON.stringify(body), signal: AbortSignal.timeout(AUTH_TIMEOUT_MS) });
  } catch (error) {
    if (isTimeout(error)) throw new ApiError(408, "timeout");
    throw error;
  }
}

function bearer(res: Response, data: { token?: string } | null) {
  return res.headers.get("set-auth-token") ?? data?.token ?? null;
}

async function enterWithToken(token: string | null) {
  establishSession(token);
  await signedIn();
}

/** Cookie session first, then the same email and password. Sign-up is not posted again. */
async function recoverAfterSignup(email: string, password: string, signupSucceeded: boolean) {
  try {
    const { data, res } = await api<{ session?: { token?: string }; token?: string } | null>("/api/auth/get-session");
    const cookie = res.headers.get("set-auth-token") ?? data?.session?.token ?? data?.token ?? null;
    if (cookie) {
      await enterWithToken(cookie);
      return;
    }
  } catch { /* no cookie session; try the password */ }
  let signInStatus = 0;
  let followUpFailed = false;
  try {
    const { data, res } = await postAuth("masuk", email, password);
    signInStatus = res.status;
    try {
      await enterWithToken(bearer(res, data));
      return;
    } catch {
      followUpFailed = true;
    }
  } catch (error) {
    signInStatus = error instanceof ApiError ? error.status : 0;
  }
  if (signInRetryStep({ signInStatus, followUpFailed, signupSucceeded }) === "created-login") {
    publishCreatedLogin(email);
    throw new ApiError(409, "created");
  }
  throw new ApiError(signInStatus, "request_failed");
}

/** Better Auth email + password. The pending flag lives outside the form so a remount keeps the button disabled. */
export async function authEmail(mode: SignInMode, email: string, password: string) {
  beginAuthAttempt(mode, email, password);
  try {
    if (mode === "daftar") {
      let signupOk = false;
      try {
        const { data, res } = await postAuth("daftar", email, password);
        signupOk = true;
        await enterWithToken(bearer(res, data));
      } catch (error) {
        const status = error instanceof ApiError ? error.status : 0;
        const step = signupStep({ status, followUpFailed: signupOk });
        if (step !== "retry-signin") throw error;
        try {
          await recoverAfterSignup(email, password, signupOk);
        } catch (retryError) {
          if (retryError instanceof ApiError && retryError.code === "created") throw retryError;
          throw error;
        }
      }
    } else {
      const { data, res } = await postAuth("masuk", email, password);
      await enterWithToken(bearer(res, data));
    }
    finishAuthAttempt(null);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 0;
    const failure = error instanceof ApiError && error.code === "created" ? "created" : failureFor(mode, status).failure;
    finishAuthAttempt({ id: ++authResultId, status, failure });
    throw error;
  }
}

async function recoverSessionCookie() {
  try {
    const { data, res } = await api<{ session?: { token?: string }; token?: string } | null>("/api/auth/get-session");
    const cookie = res.headers.get("set-auth-token") ?? data?.session?.token ?? data?.token ?? null;
    if (!cookie) return false;
    await enterWithToken(cookie);
    return true;
  } catch {
    return false;
  }
}

/** After a reload drops the sign-up response, continue from the cookie. The password did not survive the reload. */
export async function resumeAuthAttempt() {
  const attempt = parseAuthAttempt(sessionStorage.getItem(AUTH_ATTEMPT_KEY));
  if (!attempt) return;
  if (state.token && state.me) { finishAuthAttempt(null); return; }
  if (!authUiState.pending) publishAuth(true, null);
  try {
    let recovered = false;
    if (authPassword) {
      await recoverAfterSignup(attempt.email, authPassword, attempt.mode === "daftar");
      recovered = true;
    } else {
      recovered = await recoverSessionCookie();
    }
    if (!recovered) {
      if (attempt.mode === "daftar") {
        publishCreatedLogin(attempt.email);
        finishAuthAttempt({ id: ++authResultId, status: 409, failure: "created" });
        return;
      }
      finishAuthAttempt({ id: ++authResultId, status: 0, failure: "network" });
      return;
    }
    finishAuthAttempt(null);
    assignHash(authDestination(attempt.mode === "daftar" ? "#/" : "#/profil"));
  } catch (error) {
    if (error instanceof ApiError && error.code === "created") {
      finishAuthAttempt({ id: ++authResultId, status: 409, failure: "created" });
      return;
    }
    const status = error instanceof ApiError ? error.status : 0;
    finishAuthAttempt({ id: ++authResultId, status, failure: failureFor("masuk", status).failure });
  }
}

async function signedIn() {
  const version = sessionVersion;
  await restoreAccount();
  if (version !== sessionVersion) throw new ApiError(0, "session_changed");
  if (!state.me) {
    clearSession();
    throw new ApiError(502, "invalid_account");
  }
  reconcilePendingInvite(state.me.user.id);
}

/** Restore saved household data before offering setup. A solo account still needs sync consent. A paired account does not. */
export async function restoreAccount() {
  const version = sessionVersion;
  set({ checking: true, restoreError: false });
  try {
    await refreshMe();
    if (version !== sessionVersion) return;
    adoptAccountData(state.me!.user.id);
    // Read the flag and cursor first. Deleting the cursor is a full pull, not a consent reset.
    // A second member on /me is already paired. A fresh device has no local flag, so turn sync on and pull.
    const paired = state.me!.household.members.some((member) => member.id !== state.me!.user.id);
    const keepSync = storedSyncEnabled(state.me) || paired;
    if (keepSync) writeSyncEnabled(state.me!.user.id, true);
    localStorage.removeItem("bb_cursor");
    set({ syncEnabled: keepSync, status: "local" });
    if (settings().birthMode !== "postpartum" && !settings().hpl) {
      let since = 0, more = true;
      while (more) {
        const { data } = await api<{ cursor: number; changes: any[]; hasMore?: boolean }>("/sync", {
          method: "POST", body: JSON.stringify({ since, changes: [] }),
        });
        if (version !== sessionVersion) return;
        applyRemote(data.changes);
        since = data.cursor;
        more = !!data.hasMore;
      }
    }
    if (state.syncEnabled) {
      markAllDirty();
      await syncNow();
    }
  } catch {
    if (version === sessionVersion && state.token) set({ restoreError: true });
  } finally {
    if (version === sessionVersion) set({ checking: false });
  }
}

// Set while the browser is away at Google. Success returns to #/profil, cancel/deny to #/masuk-akun (errorCallbackURL).
const GOOGLE_AWAY = "bb_google";
let googleLeave: Promise<void> | null = null;
let googleAttempt = 0;

/** Drop an in-flight Google redirect. A late response must not navigate after Back. */
export function abandonGoogleStart() {
  googleAttempt += 1;
  googleLeave = null;
  sessionStorage.removeItem(GOOGLE_AWAY);
}

export function googlePhase(): "away" | "finishing" | null {
  const value = sessionStorage.getItem(GOOGLE_AWAY);
  return value === "away" || value === "finishing" ? value : null;
}

/** Better Auth social sign-in: the API answers with Google's URL (and sets its OAuth state cookie on this origin), then we leave.
 *  callbackURL stays `#/profil`. An invite token lives in storage, not in the OAuth request. */
export function startGoogle() {
  if (googleLeave) return googleLeave;
  const attempt = googleAttempt;
  googleLeave = (async () => {
    try {
      const { data } = await api<{ url?: string }>("/api/auth/sign-in/social", {
        method: "POST",
        body: JSON.stringify({
          provider: "google",
          callbackURL: `${location.origin}/#/profil`,
          errorCallbackURL: `${location.origin}/#/masuk-akun`,
        }),
      });
      if (attempt !== googleAttempt) return;
      if (!data.url) throw new ApiError(502, "no_url");
      sessionStorage.setItem(GOOGLE_AWAY, "away");
      if (attempt !== googleAttempt) return;
      location.assign(data.url);
    } catch (error) {
      if (attempt === googleAttempt) googleLeave = null;
      throw error;
    }
  })();
  return googleLeave;
}

/** True once per Google round trip that came back without signing in; clears the marker. SignIn shows "Masuk Google dibatalkan". */
export function takeGoogleReturn() {
  const away = sessionStorage.getItem(GOOGLE_AWAY) === "away";
  if (away) sessionStorage.removeItem(GOOGLE_AWAY);
  return away;
}

/** Boot after Google: the callback left a Better Auth session cookie on this origin. Trade it for the bearer, then the email path.
 *  A stored invite returns to the confirm step. It is not joined until that tap. No session: sign-in reads the marker. */
export async function finishGoogle() {
  const marker = sessionStorage.getItem(GOOGLE_AWAY);
  const action = googleReturnAction({
    marker,
    navigation: navigationType(),
    hash: location.hash,
    signedIn: !!state.token,
  });
  if (action === "clear") {
    sessionStorage.removeItem(GOOGLE_AWAY);
    return;
  }
  // Stay: cancelled return (`#/masuk-akun`) or Back onto the invite. Do not start Google.
  if (action !== "finish") return;
  sessionStorage.setItem(GOOGLE_AWAY, "finishing");
  const pending = readInvite();
  if (pending) {
    const dest = inviteReturnHash(pending);
    if (isSafeInviteReturn(dest) && location.hash !== dest) location.hash = dest;
  }
  try {
    const { data, res } = await api<{ session?: { token?: string } } | null>("/api/auth/get-session");
    const token = res.headers.get("set-auth-token") ?? data?.session?.token;
    if (!token) throw new ApiError(401, "no_session");
    establishSession(token);
    await signedIn();
  } catch {
    sessionStorage.setItem(GOOGLE_AWAY, "away");
    location.hash = "#/masuk-akun";
    return;
  }
  sessionStorage.removeItem(GOOGLE_AWAY);
  const pendingNow = readInvite();
  if (pendingNow && isInviteToken(pendingNow)) {
    sessionStorage.removeItem("bb_auth_return");
    location.hash = inviteReturnHash(pendingNow);
    return;
  }
  location.hash = authDestination();
}

export async function refreshMe() {
  const { data } = await api<Me>("/me");
  if (!data?.user?.id || typeof data.user.email !== "string" || typeof data.user.name !== "string" || !data.household?.id ||
    !Array.isArray(data.household.members) || !data.entitlement || !["free", "trial", "monthly", "plus_lifetime"].includes(data.entitlement.plan)) throw new ApiError(502, "invalid_account");
  set({ me: data, verifiedAt: Date.now() });
  return data;
}

let publishingName: string | null = null;
/** Save the name this person typed. A blank value is "never set", so the Google account name on the user row stays. */
export async function updateDisplayName(name: string) {
  const next = name.trim().slice(0, 120);
  if (!next || !state.token || !state.me) return state.me;
  if (next === state.me.user.name.trim() || publishingName === next) return state.me;
  publishingName = next;
  try {
    await api("/api/auth/update-user", { method: "POST", body: JSON.stringify({ name: next }) });
    return await refreshMe().catch(() => state.me);
  } finally {
    if (publishingName === next) publishingName = null;
  }
}

export async function signOut() {
  const token = state.token;
  if (state.syncEnabled && state.me?.user.id) writeSyncEnabled(state.me.user.id, true);
  sessionStorage.removeItem("bb_auth_return");
  sessionStorage.removeItem("bb_google");
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
  clearBrowserCaches();
  return true;
}

export type HouseholdInvite = { token: string; url: string; expiresAt: string; code?: string };

let publishedInvite: { householdId: string; invite: HouseholdInvite } | null = null;

export function inviteReadyFor(householdId: string) {
  return publishedInvite?.householdId === householdId ? publishedInvite.invite : null;
}

export async function createInvite() {
  const { data } = await api<HouseholdInvite>("/household/invite", { method: "POST", body: "{}" });
  if (data?.token && data?.url && state.me?.household.id) publishedInvite = { householdId: state.me.household.id, invite: data };
  return data;
}

export type InviteConsume = { ok: "joined" | "skipped" } | { ok: "failed"; code: string };

const inviteFlight = new Map<string, Promise<InviteConsume>>();

/** Enable sync if needed, join, and clear the stored invite. Already-paired households skip the request. */
export async function acceptInvite(token: string): Promise<"joined" | "skipped"> {
  if (!isInviteToken(token)) throw new ApiError(400, "invite_invalid");
  if (!state.token || !state.me) throw new ApiError(401, "not_ready");
  if (state.me.household.members.some((member) => member.id !== state.me!.user.id)) {
    clearInvite();
    return "skipped";
  }
  if (!state.syncEnabled) setSyncEnabled(true);
  await joinHousehold(token);
  clearInvite();
  return "joined";
}

/** One join per token while the request is in flight, including a React remount during OAuth return. */
export function consumePendingInvite(fallback?: string | null): Promise<InviteConsume> {
  const token = readInvite() || (fallback && isInviteToken(fallback) ? fallback : null);
  if (!token) return Promise.resolve({ ok: "skipped" });
  const existing = inviteFlight.get(token);
  if (existing) return existing;
  let run!: Promise<InviteConsume>;
  run = acceptInvite(token).then((ok) => ({ ok })).catch((error: unknown): InviteConsume => {
    if (error instanceof ApiError && error.code === "not_ready") return { ok: "skipped" };
    return { ok: "failed", code: error instanceof ApiError ? error.code : "" };
  }).finally(() => {
    if (inviteFlight.get(token) === run) inviteFlight.delete(token);
  });
  inviteFlight.set(token, run);
  return run;
}

const joinFlight = new Map<string, Promise<void>>();

export async function joinHousehold(token: string) {
  const existing = joinFlight.get(token);
  if (existing) return existing;
  if (!state.syncEnabled) throw new ApiError(409, "sync_disabled");
  let run!: Promise<void>;
  run = (async () => {
    syncVersion++;
    await api("/household/join", { method: "POST", body: JSON.stringify({ token }) });
    set({ hasSynced: false });
    localStorage.removeItem("bb_cursor");
    markAllDirty();
    await refreshMe();
    await syncNow();
  })().finally(() => {
    if (joinFlight.get(token) === run) joinFlight.delete(token);
  });
  joinFlight.set(token, run);
  return run;
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
  const revalidate = () => {
    if (state.token) void refreshMe().catch(() => {});
    void syncNow();
  };
  setInterval(() => {
    if (!!state.token && entitled(state.me) !== isPlus()) { set({}); void refreshMe().catch(() => {}); }
  }, 1000);

  onLocalChange(() => { clearTimeout(timer); if (state.syncEnabled) timer = setTimeout(syncNow, 1500); });
  window.addEventListener("online", revalidate);
  window.addEventListener("offline", () => state.syncEnabled && set({ status: "offline" }));
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && revalidate());
  setInterval(() => document.visibilityState === "visible" && void syncNow(), 60_000);
  if (state.token) void restoreAccount();
}
