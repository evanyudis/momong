/** Household invite parsing and partner-step state. No network. */

export const PENDING_INVITE = "bb_pending_invite";
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

export function rememberInvite(token: string, storage: Bag = localStorage, session: Bag = sessionStorage) {
  if (!isInviteToken(token)) return false;
  storage.setItem(PENDING_INVITE, token);
  session.setItem(PENDING_INVITE, token);
  return true;
}

export function readInvite(storage: Bag = localStorage, session: Bag = sessionStorage) {
  const first = session.getItem(PENDING_INVITE);
  const second = storage.getItem(PENDING_INVITE);
  if (first && isInviteToken(first)) return first;
  if (second && isInviteToken(second)) return second;
  return null;
}

export function clearInvite(storage: Bag = localStorage, session: Bag = sessionStorage) {
  storage.removeItem(PENDING_INVITE);
  session.removeItem(PENDING_INVITE);
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

export type PageNavigation = "navigate" | "reload" | "back_forward" | "prerender";

export function navigationType(): PageNavigation {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === "reload" || nav?.type === "back_forward" || nav?.type === "prerender" ? nav.type : "navigate";
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

export function joinFailureMessage(code: string) {
  if (code === "seats_full") return "Keluarga sudah memiliki dua anggota. Minta pasangan memeriksa akses keluarga.";
  if (code === "invite_invalid") return "Undangan sudah tidak berlaku. Minta tautan baru dari pasangan.";
  if (code === "not_ready") return "Masuk dulu, lalu tempel kode undangan.";
  return "Belum bisa bergabung. Cek koneksi lalu coba lagi.";
}
