/** Household invite parsing and partner-step state. No network. */

export const PENDING_INVITE = "bb_pending_invite";
export const PENDING_INVITE_AT = "bb_pending_invite_at";
export const PENDING_INVITE_USER = "bb_pending_invite_user";
export const PENDING_INVITE_NAME = "bb_pending_invite_name";
/** Matches the server invite lifetime. A saved link does not outlive that. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const INVITE_SENT = "bb_invite_sent";

/** Opaque invite tokens and server-issued codes. No spaces, slashes, or query breaks. */
const TOKEN = /^[A-Za-z0-9._~+=-]{6,512}$/;

export type SyncStepStatus = "local" | "offline" | "syncing" | "synced" | "error";
export type PairStepState = "done" | "current" | "pending" | "error";
export type PairStep = { id: "sent" | "login" | "synced"; label: string; state: PairStepState };

type Bag = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const isInviteToken = (value: string) => TOKEN.test(value);

export function inviteReturnHash(token: string) {
  return `#/gabung?invite=${encodeURIComponent(token)}`;
}

/** Only an in-app invite return. Anything else is dropped so auth cannot become an open redirect. */
export function isSafeInviteReturn(target: string) {
  if (!target.startsWith("#/gabung?")) return false;
  const params = new URLSearchParams(target.slice("#/gabung?".length));
  const invite = params.get("invite");
  if (!invite || !isInviteToken(invite)) return false;
  return [...params.keys()].every((key) => key === "invite");
}

export function inviteTokenFromInput(input: string) {
  const raw = input.trim();
  if (!raw) return null;
  const fromQuery = (query: string) => {
    const token = new URLSearchParams(query).get("invite");
    return token && isInviteToken(token) ? token : null;
  };
  try {
    const url = new URL(raw);
    const hash = url.hash.replace(/^#/, "");
    const hashQuery = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
    return fromQuery(hashQuery) || fromQuery(url.search.replace(/^\?/, "")) || null;
  } catch {
    return isInviteToken(raw) ? raw : null;
  }
}

/** Short code from POST /household/invite when the API sends `code`; otherwise the token itself. */
export function displayInviteCode(invite: { token: string; code?: string }) {
  const code = invite.code?.trim();
  if (code && isInviteToken(code)) return code;
  return invite.token;
}

export function isWhatsAppBrowser(ua: string) {
  return /WhatsApp/i.test(ua);
}

export function isAndroid(ua: string) {
  return /Android/i.test(ua);
}

/**
 * Leaves WhatsApp's in-app browser.
 * Android: Chrome intent. The hash is encoded so `#Intent` stays the intent marker.
 * iOS: the https URL, opened with target=_blank, which WhatsApp hands to Safari.
 */
export function externalBrowserHref(pageUrl: string, ua: string) {
  if (!isAndroid(ua)) return pageUrl;
  let parsed: URL;
  try { parsed = new URL(pageUrl); } catch { return pageUrl; }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return pageUrl;
  const scheme = parsed.protocol.replace(":", "");
  const path = `${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`.replace(/#/g, "%23");
  const fallback = encodeURIComponent(pageUrl);
  return `intent://${path}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}

export function rememberInvite(
  token: string,
  storage: Bag = localStorage,
  session: Bag = sessionStorage,
  meta: { at?: number; accountId?: string | null; name?: string | null } = {},
) {
  if (!isInviteToken(token)) return false;
  const at = String(meta.at ?? Date.now());
  const name = meta.name?.trim().slice(0, 80) ?? "";
  const previous = storedToken(storage, session);
  storage.setItem(PENDING_INVITE, token);
  session.setItem(PENDING_INVITE, token);
  storage.setItem(PENDING_INVITE_AT, at);
  session.setItem(PENDING_INVITE_AT, at);
  if (name) {
    storage.setItem(PENDING_INVITE_NAME, name);
    session.setItem(PENDING_INVITE_NAME, name);
  } else if (previous !== token) {
    storage.removeItem(PENDING_INVITE_NAME);
    session.removeItem(PENDING_INVITE_NAME);
  }
  if (meta.accountId) {
    storage.setItem(PENDING_INVITE_USER, meta.accountId);
    session.setItem(PENDING_INVITE_USER, meta.accountId);
  } else {
    storage.removeItem(PENDING_INVITE_USER);
    session.removeItem(PENDING_INVITE_USER);
  }
  return true;
}

function storedToken(storage: Bag, session: Bag) {
  const first = session.getItem(PENDING_INVITE);
  const second = storage.getItem(PENDING_INVITE);
  if (first && isInviteToken(first)) return first;
  if (second && isInviteToken(second)) return second;
  return null;
}

function storedAt(storage: Bag, session: Bag) {
  const raw = session.getItem(PENDING_INVITE_AT) || storage.getItem(PENDING_INVITE_AT);
  const at = Number(raw);
  return Number.isFinite(at) ? at : null;
}

export function readInvite(storage: Bag = localStorage, session: Bag = sessionStorage, now = Date.now()) {
  const token = storedToken(storage, session);
  if (!token) return null;
  const at = storedAt(storage, session);
  if (at === null || now > at + INVITE_TTL_MS) {
    clearInvite(storage, session);
    return null;
  }
  return token;
}

export function readInviteName(storage: Bag = localStorage, session: Bag = sessionStorage) {
  return (session.getItem(PENDING_INVITE_NAME) || storage.getItem(PENDING_INVITE_NAME) || "").trim().slice(0, 80);
}

/**
 * A link opened before login is claimed by the account that signs in.
 * An invite saved for a different account stays until that person chooses.
 */
export function reconcilePendingInvite(currentAccountId: string | null, now = Date.now(), storage: Bag = localStorage, session: Bag = sessionStorage) {
  const token = readInvite(storage, session, now);
  if (!token) return "cleared" as const;
  const stored = session.getItem(PENDING_INVITE_USER) || storage.getItem(PENDING_INVITE_USER);
  if (currentAccountId && stored && stored !== currentAccountId) return "foreign" as const;
  if (currentAccountId && !stored) {
    storage.setItem(PENDING_INVITE_USER, currentAccountId);
    session.setItem(PENDING_INVITE_USER, currentAccountId);
    return "claimed" as const;
  }
  return "kept" as const;
}

/** Use a saved invite on the account that is signed in now. */
export function claimForeignInvite(currentAccountId: string, storage: Bag = localStorage, session: Bag = sessionStorage, now = Date.now()) {
  if (!currentAccountId || !readInvite(storage, session, now)) return false;
  storage.setItem(PENDING_INVITE_USER, currentAccountId);
  session.setItem(PENDING_INVITE_USER, currentAccountId);
  return true;
}

/** A successful join opens Pasangan. A skipped or failed join stays on Gabung. */
export function joinResultRoute(result: "joined" | "skipped" | "failed"): "pasangan" | "stay" {
  return result === "joined" ? "pasangan" : "stay";
}

/** Nanti leaves the confirm sheet for Beranda. The saved invite stays. An invite return is dropped so this visit is not sent back. */
export function declineJoin(input: { authReturn: string | null }): { hash: "#/"; authReturn: string | null } {
  const authReturn = input.authReturn && isSafeInviteReturn(input.authReturn) ? null : input.authReturn;
  return { hash: "#/", authReturn };
}

export function joinConfirmCopy(name: string) {
  const house = name.trim();
  return house ? `Gabung ke rumah ${house}?` : "Gabung ke rumah ini?";
}

/**
 * Logged-out invite visits stay on a choice screen. A page load never starts Google.
 * The invite token does not include a household id, and joining a different house would move
 * this account, so a partner already on the account is already connected.
 */
export function inviteEntry(input: { signedIn: boolean; validInvite: boolean; hasPartner?: boolean }): "choose" | "confirm" | "connected" | "ignore" {
  if (!input.validInvite) return "ignore";
  if (!input.signedIn) return "choose";
  if (input.hasPartner) return "connected";
  return "confirm";
}

/**
 * What to do with a leftover Google marker on boot.
 * Only the OAuth callback (`#/profil`) may continue. Home, a reload, and a cancelled return do not start Google.
 */
export function googleReturnAction(input: {
  marker: string | null;
  navigation: string;
  hash: string;
  signedIn: boolean;
}): "finish" | "stay" | "clear" {
  const marker = input.marker === "away" || input.marker === "finishing" ? input.marker : null;
  if (!marker) return "stay";
  if (input.signedIn) return "clear";
  if (input.hash.startsWith("#/masuk-akun")) return "stay";
  if (input.navigation === "back_forward" && input.hash.startsWith("#/gabung?")) return "stay";
  if (marker === "away" && (input.hash === "#/profil" || input.hash.startsWith("#/profil?"))) return "finish";
  return "clear";
}

/** First click claims the join. A second click while it is held does nothing. */
export function claimJoinClick(lock: { held: boolean }) {
  if (lock.held) return false;
  lock.held = true;
  return true;
}

/**
 * Back from Google restores the choice screen from bfcache with the buttons still busy.
 * A persisted page, or becoming visible again while the start is pending, re-enables them.
 * A real callback still in `finishing` is left alone.
 */
export function googleChoiceResume(input: {
  busy: boolean;
  marker: string | null;
  persisted: boolean;
  visible: boolean;
}): "reset" | "keep" {
  if (input.marker === "finishing") return "keep";
  const cameBack = input.persisted || input.visible;
  if (!cameBack) return "keep";
  if (input.busy || input.marker === "away") return "reset";
  return "keep";
}

/** Log rows that would move with a join. Profile setup is not an entry. */
const LOG_COLLECTIONS = ["contractions", "kicks", "symptoms", "bag", "bottle", "breast", "pump", "diaper", "wishlist"] as const;

export function localLogCount(db: unknown) {
  if (!db || typeof db !== "object") return 0;
  const data = db as Record<string, unknown>;
  return LOG_COLLECTIONS.reduce((sum, col) => {
    const rows = data[col];
    if (!rows || typeof rows !== "object") return sum;
    return sum + Object.values(rows as Record<string, { deleted?: boolean }>).filter((row) => !!row && !row.deleted).length;
  }, 0);
}

/** Shown only when this account already has notes on the phone or a sync cursor. */
export const JOIN_DATA_WARNING = "Catatan di HP ini akan ikut. Catatan yang hanya ada di server untuk rumah lama mungkin tidak muncul lagi.";

export function joinDataWarning(input: { localRecords: number; syncCursor: number }) {
  const records = Number.isFinite(input.localRecords) && input.localRecords > 0;
  const cursor = Number.isFinite(input.syncCursor) && input.syncCursor > 0;
  return records || cursor ? JOIN_DATA_WARNING : null;
}

/** Owner name carried on a shared link. The API invite payload has no household name. */
export function inviteOwnerName(input: string) {
  const read = (query: string) => {
    const name = new URLSearchParams(query).get("dari")?.trim() ?? "";
    if (!name || name.length > 80 || /[\u0000-\u001f]/.test(name)) return "";
    return name;
  };
  const raw = input.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const hash = url.hash.replace(/^#/, "");
    const hashQuery = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
    return read(hashQuery) || read(url.search.replace(/^\?/, ""));
  } catch {
    const query = raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : "";
    return read(query);
  }
}

/** Shared link includes the owner name so the confirm step can name the household. */
export function inviteLinkWithOwner(url: string, ownerName: string) {
  const name = ownerName.trim();
  if (!name) return url;
  try {
    const parsed = new URL(url);
    const hash = parsed.hash.replace(/^#/, "");
    const qIndex = hash.indexOf("?");
    if (qIndex === -1) return url;
    const params = new URLSearchParams(hash.slice(qIndex + 1));
    params.set("dari", name.slice(0, 80));
    parsed.hash = `${hash.slice(0, qIndex)}?${params.toString()}`;
    return parsed.toString();
  } catch {
    return url;
  }
}

export function clearInvite(storage: Bag = localStorage, session: Bag = sessionStorage) {
  for (const bag of [storage, session]) {
    bag.removeItem(PENDING_INVITE);
    bag.removeItem(PENDING_INVITE_AT);
    bag.removeItem(PENDING_INVITE_USER);
    bag.removeItem(PENDING_INVITE_NAME);
  }
}

export function markInviteSent(householdId: string, storage: Bag = localStorage) {
  if (!householdId) return;
  storage.setItem(`${INVITE_SENT}:${householdId}`, "1");
}

export function inviteWasSent(householdId: string, storage: Bag = localStorage) {
  return !!householdId && storage.getItem(`${INVITE_SENT}:${householdId}`) === "1";
}

const STEP_STATE_LABEL: Record<PairStepState, string> = {
  done: "Selesai",
  current: "Sedang berjalan",
  pending: "Belum",
  error: "Coba lagi",
};

export const pairStepLabel = (state: PairStepState) => STEP_STATE_LABEL[state];

/** Three statuses on the partner screen. Partner presence and sync status move them. */
export function pairSteps(input: {
  inviteSent: boolean;
  hasPartner: boolean;
  syncEnabled: boolean;
  syncStatus: SyncStepStatus;
}): PairStep[] {
  const sent = input.inviteSent || input.hasPartner;
  const loggedIn = input.hasPartner;
  const synced = loggedIn && input.syncEnabled && input.syncStatus === "synced";
  const syncProblem = loggedIn && input.syncEnabled && (input.syncStatus === "error" || input.syncStatus === "offline");
  const third: PairStepState = synced ? "done" : syncProblem ? "error" : loggedIn ? "current" : "pending";
  return [
    { id: "sent", label: "Undangan terkirim", state: sent ? "done" : "current" },
    { id: "login", label: "Pasangan login", state: loggedIn ? "done" : sent ? "current" : "pending" },
    { id: "synced", label: "Tersinkron", state: third },
  ];
}

export type PageNavigation = "navigate" | "reload" | "back_forward";

export function navigationType(): PageNavigation {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const type = nav?.type;
  return type === "reload" || type === "back_forward" ? type : "navigate";
}

/** A leftover bb_google on a fresh invite open is not a cancelled Google return. Back/forward keeps it. */
export function shouldClearStaleGoogle(hash: string, marker: string | null, navigation: string) {
  if (marker !== "away" && marker !== "finishing") return false;
  if (!hash.startsWith("#/gabung?")) return false;
  return navigation !== "back_forward";
}

/** The red "Masuk Google belum selesai" line. A failed start (403, offline) is not a return. */
export function inviteShowsGoogleError(input: { returnedWithoutSession: boolean; startFailed: boolean }) {
  return input.returnedWithoutSession;
}

/** Session cache of tokens POST /household/join already rejected. Keyed per token. */
export const INVITE_INVALID_CACHE = "bb_invite_invalid:";

export function rememberInviteInvalid(token: string, session: Bag = sessionStorage) {
  if (!isInviteToken(token)) return false;
  session.setItem(INVITE_INVALID_CACHE + token, "1");
  return true;
}

export function readInviteInvalid(token: string, session: Bag = sessionStorage) {
  return isInviteToken(token) && session.getItem(INVITE_INVALID_CACHE + token) === "1";
}

/** Raw `invite` query value, including tokens that fail the format check. */
export function inviteParamFromHash(hash: string) {
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(query).get("invite");
}

export function inviteTokenFromHash(hash: string) {
  const token = inviteParamFromHash(hash);
  return token && isInviteToken(token) ? token : null;
}

/**
 * House name for this token only.
 * A saved name belongs to the stored token. A different token does not inherit it.
 */
export function houseNameForInvite(token: string | null, hash: string, storage: Bag = localStorage, session: Bag = sessionStorage) {
  if (!token || !isInviteToken(token)) return "";
  if (inviteTokenFromHash(hash) === token) {
    const fromHash = inviteOwnerName(hash);
    if (fromHash) return fromHash;
  }
  if (storedToken(storage, session) === token) return readInviteName(storage, session);
  return "";
}

export type InvitePreview =
  | { status: "invalid" }
  | { status: "unknown" }
  | { status: "valid"; houseName?: string };

/** What the client can prove before any preview request. */
export function localInvitePreview(token: string | null, session: Bag = sessionStorage): InvitePreview {
  if (!token || !isInviteToken(token) || readInviteInvalid(token, session)) return { status: "invalid" };
  return { status: "unknown" };
}

/**
 * Read-only preview seam. momong-api does not ship GET /household/invite/:token yet.
 * `requestInvitePreview` stays null until that endpoint exists.
 * Null falls back to local knowledge: invalid stays invalid, everything else stays unknown.
 * Unknown keeps today's confirm step after the check state.
 */
export async function requestInvitePreview(_token: string): Promise<InvitePreview | null> {
  return null;
}

export async function fetchInvitePreview(token: string, session: Bag = sessionStorage): Promise<InvitePreview> {
  const local = localInvitePreview(token, session);
  if (local.status === "invalid") return local;
  try {
    const remote = await requestInvitePreview(token);
    return remote ?? local;
  } catch {
    return local;
  }
}

export type GabungPhase = "checking" | "ask" | "joining" | "error";

export function gabungPhaseForToken(token: string | null, session: Bag = sessionStorage): { phase: GabungPhase; joinCode: string } {
  if (!token) return { phase: "error", joinCode: "" };
  if (!isInviteToken(token) || readInviteInvalid(token, session)) return { phase: "error", joinCode: "invite_invalid" };
  return { phase: "checking", joinCode: "" };
}

/** Null when the token is unchanged. A new token drops phase, error code, and the previous house. */
export function gabungOnTokenChange(current: string | null, next: string | null, session: Bag = sessionStorage) {
  if (next === current) return null;
  return { token: next, ...gabungPhaseForToken(next, session) };
}

export function gabungAfterPreview(phase: GabungPhase, preview: InvitePreview): GabungPhase {
  if (preview.status === "invalid") return "error";
  if (phase === "checking" && (preview.status === "unknown" || preview.status === "valid")) return "ask";
  return phase;
}

export function houseNameAfterPreview(current: string, preview: InvitePreview) {
  if (preview.status !== "valid") return current;
  const name = preview.houseName?.trim().slice(0, 80) ?? "";
  return name || current;
}

/**
 * The confirm sheet opens only after a check that did not prove the token invalid.
 * Format failures and a cached invite_invalid result never open it.
 * `checking` is the neutral wait. `unknown` is today's confirm step.
 */
export function gabungSheetOpen(input: {
  token: string | null;
  phase: GabungPhase;
  joinCode: string;
  signedIn: boolean;
  hasPartner: boolean;
  session?: Bag;
}) {
  const session = input.session ?? sessionStorage;
  if (!input.token || !isInviteToken(input.token)) return false;
  if (readInviteInvalid(input.token, session)) return false;
  if (input.joinCode === "invite_invalid") return false;
  if (!input.signedIn || input.hasPartner) return false;
  return input.phase === "ask" || input.phase === "joining";
}

export const INVITE_INVALID_TITLE = "Tautan tidak valid atau sudah kedaluwarsa";

export function joinFailureMessage(code: string) {
  if (code === "seats_full") return "Keluarga sudah memiliki dua anggota. Minta pasangan memeriksa akses keluarga.";
  if (code === "invite_invalid") return `${INVITE_INVALID_TITLE}. Minta tautan baru dari pasangan.`;
  if (code === "not_ready") return "Masuk dulu, lalu tempel kode undangan.";
  return "Belum bisa bergabung. Cek koneksi lalu coba lagi.";
}
