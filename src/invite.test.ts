import assert from "node:assert/strict";
import { test } from "node:test";
import {
  claimJoinClick, clearInvite, declineJoin, displayInviteCode, externalBrowserHref, fetchInvitePreview, gabungAfterJoin, gabungAfterPreview, gabungClickResult, gabungErrorActions, gabungHouseName, gabungJoinScreen, gabungOnTokenChange, gabungPhaseForToken, gabungSheetOpen, googleChoiceResume, googleReturnAction, houseNameForInvite, householdInviteRequest, INVITE_INVALID_TITLE, inviteEntry, inviteLinkWithOwner, inviteOwnerName, inviteParamFromHash, inviteReturnHash, inviteShowsGoogleError, inviteTokenFromInput, inviteWasSent, joinCodeAfterPreview, mapServerInvitePreview,
  gabungConfirmOpen, gabungNantiAction, inviteFlowActive, isAndroid, isInviteToken, isSafeInviteReturn, isWhatsAppBrowser, joinConfirmCopy, joinDataWarning, joinFailureMessage, joinResultRoute, localLogCount, loginInviteChoice, markInviteFlow, markInviteSent, onboardingExitHash, pairSteps, postLoginRoute, readInvite, readInviteOwner, reconcilePendingInvite, rememberInvite, rememberInviteInvalid, settleGabungNanti, shouldClearStaleGoogle,
} from "./invite.ts";

const bag = () => {
  const memory = new Map<string, string>();
  return {
    memory,
    storage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => void memory.set(key, value),
      removeItem: (key: string) => void memory.delete(key),
    },
  };
};

test("invite token is read from a hash link, a query link, or the raw code", () => {
  const token = "abC123_-AAAAAAAAAAAAAAAA";
  assert.equal(token.length, 24);
  assert.equal(inviteTokenFromInput(`https://momong.evanyudis.com/#/gabung?invite=${token}`), token);
  assert.equal(inviteTokenFromInput(`https://momong.evanyudis.com/gabung?invite=${token}`), token);
  assert.equal(inviteTokenFromInput(`  ${token}  `), token);
  assert.equal(inviteTokenFromInput("https://momong.evanyudis.com/#/gabung"), null);
  assert.equal(inviteTokenFromInput("javascript:alert(1)"), null);
  assert.equal(inviteTokenFromInput("short"), null);
  assert.equal(inviteTokenFromInput("has space"), null);
  assert.equal(inviteTokenFromInput("abC123._~"), null);
});

test("auth return accepts only the invite hash", () => {
  const hash = inviteReturnHash("inviteTok1");
  assert.equal(isSafeInviteReturn(hash), true);
  assert.equal(isSafeInviteReturn("#/plus"), false);
  assert.equal(isSafeInviteReturn("https://attacker.example/#/gabung?invite=inviteTok1"), false);
  assert.equal(isSafeInviteReturn("#/gabung?invite=inviteTok1&next=https://attacker.example"), false);
  assert.equal(isSafeInviteReturn("#/gabung?invite=../admin"), false);
});

test("WhatsApp opens Chrome on Android and keeps the https link on iPhone", () => {
  const page = "https://momong.evanyudis.com/#/gabung?invite=inviteTok1";
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/24.1.0";
  const android = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.1";
  assert.equal(isWhatsAppBrowser(iphone), true);
  assert.equal(isWhatsAppBrowser(android), true);
  assert.equal(isWhatsAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1"), false);
  assert.equal(externalBrowserHref(page, iphone), page);
  const intent = externalBrowserHref(page, android);
  assert.equal(isAndroid(android), true);
  assert.match(intent, /^intent:\/\/momong\.evanyudis\.com\/%23\/gabung\?invite=inviteTok1#Intent;scheme=https;package=com\.android\.chrome;/);
  assert.match(intent, /browser_fallback_url=https%3A%2F%2Fmomong\.evanyudis\.com%2F%23%2Fgabung%3Finvite%3DinviteTok1;end$/);
  assert.equal(intent.includes("#/gabung"), false);
});

test("saved invite expires after seven days and drops for a different account", () => {
  const local = bag();
  const session = bag();
  const now = Date.parse("2026-10-01T00:00:00Z");
  const day = 24 * 60 * 60 * 1000;
  assert.equal(rememberInvite("inviteTok1", local.storage, session.storage, { at: now, accountId: "user-a", name: "Sari" }), true);
  assert.equal(readInvite(local.storage, session.storage, now + 6 * day), "inviteTok1");
  assert.equal(reconcilePendingInvite("user-a", now + 6 * day, local.storage, session.storage), "kept");
  assert.equal(readInvite(local.storage, session.storage, now + 6 * day), "inviteTok1");
  assert.equal(reconcilePendingInvite("user-b", now + day, local.storage, session.storage), "cleared");
  assert.equal(readInvite(local.storage, session.storage, now + day), null, "a different account drops the invite");

  assert.equal(rememberInvite("inviteTok1", local.storage, session.storage, { at: now, name: "Sari" }), true);
  assert.equal(readInviteOwner(local.storage, session.storage), null);
  assert.equal(reconcilePendingInvite("user-b", now, local.storage, session.storage), "cleared");
  assert.equal(readInvite(local.storage, session.storage, now), null, "a missing owner is stale");
  assert.equal(local.storage.getItem("bb_pending_invite_user"), null);

  assert.equal(rememberInvite("inviteTok1", local.storage, session.storage, { at: now, accountId: "user-a", name: "Sari" }), true);
  assert.equal(rememberInvite("inviteTok1", local.storage, session.storage, { at: now, name: "Sari" }), true);
  assert.equal(readInviteOwner(local.storage, session.storage), "user-a", "omitting the owner does not erase one");
  const freshSession = bag();
  assert.equal(readInviteOwner(local.storage, freshSession.storage), "user-a");
  assert.equal(reconcilePendingInvite("user-a", now, local.storage, freshSession.storage), "kept");
  assert.equal(reconcilePendingInvite("user-f", now, local.storage, freshSession.storage), "cleared");
  assert.equal(local.storage.getItem("bb_pending_invite"), null, "a new session still sees the saved owner");

  assert.equal(rememberInvite("inviteTok1", local.storage, session.storage, { at: now, accountId: null }), true);
  markInviteFlow(now, local.storage);
  assert.equal(reconcilePendingInvite("user-new", now, local.storage, session.storage), "claimed");
  assert.equal(readInvite(local.storage, session.storage, now), "inviteTok1");
  assert.equal(readInviteOwner(local.storage, session.storage), "user-new");
  assert.equal(inviteFlowActive(now, local.storage), false);
  markInviteFlow(now, local.storage);
  assert.equal(rememberInvite("inviteTok1", local.storage, session.storage, { at: now, accountId: "user-a" }), true);
  assert.equal(reconcilePendingInvite("user-b", now, local.storage, session.storage, true), "cleared", "a different owner is still a leftover during a new flow");
  assert.equal(readInvite(local.storage, session.storage, now), null);

  assert.equal(postLoginRoute({ fallback: "#/profil", invite: "inviteTok1", onboarded: false }), "#/profil");
  assert.equal(postLoginRoute({ fallback: "#/profil", invite: "inviteTok1", onboarded: true }), "#/gabung?invite=inviteTok1");
  assert.equal(onboardingExitHash({ accountId: "user-new", ownerId: "user-new", token: "inviteTok1" }), "#/gabung?invite=inviteTok1");
  assert.equal(onboardingExitHash({ accountId: "user-new", ownerId: "user-old", token: "inviteTok1" }), "#/");
  assert.equal(onboardingExitHash({ accountId: null, ownerId: null, token: "inviteTok1" }), "#/");
  const nanti = gabungNantiAction({ phase: "ask", leaving: false, authReturn: "#/gabung?invite=inviteTok1" });
  assert.equal(nanti.type, "leave");
  if (nanti.type === "leave") {
    assert.equal(nanti.hash, "#/");
    assert.equal(nanti.authReturn, null);
  }
  assert.deepEqual(gabungNantiAction({ phase: "left", leaving: true, authReturn: null }), { type: "ignore" });
  assert.deepEqual(gabungNantiAction({ phase: "joining", leaving: false, authReturn: null }), { type: "ignore" });
  const asking = { phase: "ask", leaving: false, dismissed: false, hash: "#/gabung?invite=inviteTok1", authReturn: "#/gabung?invite=inviteTok1", invite: "inviteTok1" };
  assert.equal(gabungConfirmOpen(asking), true);
  const firstTap = settleGabungNanti(asking);
  assert.equal(firstTap.hash, "#/", "one tap leaves for Beranda");
  assert.equal(firstTap.invite, "inviteTok1", "Nanti keeps the saved invite");
  assert.equal(firstTap.authReturn, null);
  assert.equal(gabungConfirmOpen(firstTap), false, "the sheet closes on that tap");
  const dismissAfter = settleGabungNanti(firstTap);
  assert.equal(dismissAfter, firstTap, "the close that follows the tap does not run again");
  assert.equal(gabungConfirmOpen({ ...firstTap, phase: "ask" }), false, "a saved invite does not reopen the sheet");
  assert.equal(gabungConfirmOpen(settleGabungNanti({ ...asking, phase: "joining" })), true, "joining is not dismissed");

  assert.equal(rememberInvite("inviteTok1", local.storage, session.storage, { at: now, accountId: "user-b", name: "Sari" }), true);
  assert.equal(readInvite(local.storage, session.storage, now + 8 * day), null);
  assert.equal(local.storage.getItem("bb_pending_invite"), null);
});

test("login does not open a stale or dead saved invite", () => {
  const dead = { status: "invalid" as const };
  const live = { status: "valid" as const, houseName: "Sari" };
  const full = { status: "full" as const, houseName: "Sari" };
  assert.equal(loginInviteChoice({ accountId: "user-a", ownerId: "user-a", explicit: false, preview: null }), "open");
  assert.equal(loginInviteChoice({ accountId: "user-a", ownerId: "user-a", explicit: false, preview: live }), "open");
  assert.equal(loginInviteChoice({ accountId: "user-a", ownerId: "user-a", explicit: false, preview: full }), "open");
  assert.equal(loginInviteChoice({ accountId: "user-a", ownerId: "user-a", explicit: false, preview: dead }), "drop");
  assert.equal(loginInviteChoice({ accountId: "user-f", ownerId: "user-g", explicit: false, preview: live }), "drop");
  assert.equal(loginInviteChoice({ accountId: "user-f", ownerId: null, explicit: false, preview: null }), "drop");
  assert.equal(loginInviteChoice({ accountId: "user-f", ownerId: null, explicit: true, preview: null }), "open");
  assert.equal(loginInviteChoice({ accountId: "user-f", ownerId: "user-g", explicit: true, preview: live }), "open");
  assert.equal(loginInviteChoice({ accountId: "user-f", ownerId: "user-g", explicit: true, preview: dead }), "drop");
  assert.equal(mapServerInvitePreview({ status: "expired", householdName: null, full: false })?.status, "invalid");
  assert.equal(mapServerInvitePreview({ status: "used", householdName: null, full: true })?.status, "invalid");
});

test("a profile with no log entries does not warn on join", () => {
  const db = { settings: { main: { id: "main", babyName: "Bayi A", birthMode: "postpartum" } }, kicks: { old: { id: "old", deleted: true } } };
  assert.equal(localLogCount(db), 0);
  assert.equal(joinDataWarning({ localRecords: localLogCount(db), syncCursor: 0 }), null);
  assert.equal(localLogCount({ kicks: { a: { id: "a" } } }), 1);
});

test("join warning only when this account already has notes or a sync cursor", () => {
  assert.equal(joinDataWarning({ localRecords: 0, syncCursor: 0 }), null);
  const withRecords = joinDataWarning({ localRecords: 1, syncCursor: 0 });
  const withCursor = joinDataWarning({ localRecords: 0, syncCursor: 3 });
  const withBoth = joinDataWarning({ localRecords: 2, syncCursor: 3 });
  assert.ok(withRecords);
  assert.equal(withCursor, withRecords);
  assert.equal(withBoth, withRecords);
  assert.match(withRecords, /HP ini akan ikut/);
  assert.match(withRecords, /hanya ada di server/);
});

test("confirm step names the household from the shared link", () => {
  const link = inviteLinkWithOwner("https://momong.evanyudis.com/#/gabung?invite=inviteTok1", "Sari");
  assert.equal(inviteOwnerName(link), "Sari");
  const asStored = inviteLinkWithOwner("https://momong.evanyudis.com/#/gabung?invite=inviteTok1", "qa-d-1018");
  assert.equal(inviteOwnerName(asStored), "qa-d-1018");
  assert.equal(asStored.includes("Qa-d-1018"), false, "dari= uses the name as stored");
  assert.equal(gabungHouseName({ serverName: "qa-d-1018", fallbackName: "Qa-d-1018", source: "server" }), "qa-d-1018");
  assert.equal(inviteTokenFromInput(link), "inviteTok1");
  assert.equal(joinConfirmCopy("Sari"), "Gabung ke rumah Sari?");
  assert.equal(joinConfirmCopy("  "), "Gabung ke rumah ini?");
  assert.equal(isSafeInviteReturn("#/gabung?invite=inviteTok1&dari=Sari"), false);
});

test("invite token survives in both storages and a sent flag is per household", () => {
  const local = bag();
  const session = bag();
  assert.equal(rememberInvite("nope", local.storage, session.storage), false);
  assert.equal(rememberInvite("inviteTok1", local.storage, session.storage), true);
  assert.equal(readInvite(local.storage, session.storage), "inviteTok1");
  session.storage.removeItem("bb_pending_invite");
  assert.equal(readInvite(local.storage, session.storage), "inviteTok1");
  clearInvite(local.storage, session.storage);
  assert.equal(readInvite(local.storage, session.storage), null);
  assert.equal(inviteWasSent("h1", local.storage), false);
  markInviteSent("h1", local.storage);
  assert.equal(inviteWasSent("h1", local.storage), true);
  assert.equal(inviteWasSent("h2", local.storage), false);
});

test("short code is shown only when the server sends one the join call can accept", () => {
  assert.equal(displayInviteCode({ token: "inviteTok1" }), "inviteTok1");
  assert.equal(displayInviteCode({ token: "inviteTok1", code: "kode12" }), "kode12");
  assert.equal(displayInviteCode({ token: "inviteTok1", code: "bad code" }), "inviteTok1");
});

test("partner steps move from invite sent to login to synced", () => {
  const base = { inviteSent: false, hasPartner: false, syncEnabled: true, syncStatus: "local" as const };
  assert.deepEqual(pairSteps(base).map((step) => step.state), ["current", "pending", "pending"]);
  assert.deepEqual(pairSteps({ ...base, inviteSent: true }).map((step) => [step.label, step.state]), [
    ["Undangan terkirim", "done"],
    ["Pasangan login", "current"],
    ["Tersinkron", "pending"],
  ]);
  const paired = { ...base, inviteSent: true, hasPartner: true };
  assert.deepEqual(pairSteps(paired).map((step) => step.state), ["done", "done", "current"]);
  assert.deepEqual(pairSteps({ ...paired, syncStatus: "syncing" }).map((step) => step.state), ["done", "done", "current"]);
  assert.deepEqual(pairSteps({ ...paired, syncStatus: "synced" }).map((step) => step.state), ["done", "done", "done"]);
  assert.deepEqual(pairSteps({ ...paired, syncStatus: "error" }).map((step) => step.state), ["done", "done", "error"]);
  assert.deepEqual(pairSteps({ ...paired, syncStatus: "offline" }).map((step) => step.state), ["done", "done", "error"]);
  assert.equal(pairSteps({ ...base, hasPartner: true, inviteSent: false }).map((step) => step.state)[0], "done");
});

test("logged-out invite stays on the choice screen and a saved invite never starts Google", () => {
  assert.equal(inviteEntry({ signedIn: false, validInvite: true }), "choose");
  assert.equal(inviteEntry({ signedIn: true, validInvite: true }), "confirm");
  assert.equal(inviteEntry({ signedIn: true, validInvite: true, hasPartner: true }), "connected");
  assert.equal(inviteEntry({ signedIn: false, validInvite: true, hasPartner: true }), "choose");
  assert.equal(inviteEntry({ signedIn: false, validInvite: false }), "ignore");
  assert.equal(googleReturnAction({ marker: null, navigation: "navigate", hash: "#/gabung?invite=inviteTok1", signedIn: false }), "stay");
  assert.equal(googleReturnAction({ marker: "away", navigation: "navigate", hash: "#/", signedIn: false }), "clear");
  assert.equal(googleReturnAction({ marker: "away", navigation: "reload", hash: "/", signedIn: false }), "clear");
  assert.equal(googleReturnAction({ marker: "away", navigation: "reload", hash: "#/gabung?invite=inviteTok1", signedIn: false }), "clear");
});

test("hard reload of a logged-out invite does not continue Google", () => {
  const hashes = ["#/gabung?invite=inviteTok1", "#/gabung?invite=inviteTok1&dari=Sari", "#/"];
  for (const hash of hashes) {
    for (const marker of [null, "away", "finishing", "other"]) {
      assert.notEqual(googleReturnAction({ marker, navigation: "reload", hash, signedIn: false }), "finish");
    }
  }
  assert.equal(inviteEntry({ signedIn: false, validInvite: true }), "choose");
});

test("cancelled Google does not loop into another redirect", () => {
  assert.equal(googleReturnAction({ marker: "away", navigation: "navigate", hash: "#/masuk-akun", signedIn: false }), "stay");
  assert.equal(googleReturnAction({ marker: "away", navigation: "back_forward", hash: "#/gabung?invite=inviteTok1", signedIn: false }), "stay");
  assert.equal(googleReturnAction({ marker: "away", navigation: "navigate", hash: "#/profil", signedIn: false }), "finish");
  assert.equal(googleReturnAction({ marker: "away", navigation: "navigate", hash: "#/profil", signedIn: true }), "clear");
  assert.equal(googleReturnAction({ marker: "finishing", navigation: "reload", hash: "#/", signedIn: false }), "clear");
});

test("back from Google re-enables the choice buttons", () => {
  assert.equal(googleChoiceResume({ busy: true, marker: "away", persisted: true, visible: false }), "reset");
  assert.equal(googleChoiceResume({ busy: true, marker: "away", persisted: false, visible: true }), "reset");
  assert.equal(googleChoiceResume({ busy: true, marker: null, persisted: true, visible: false }), "reset");
  assert.equal(googleChoiceResume({ busy: false, marker: null, persisted: false, visible: true }), "keep");
  assert.equal(googleChoiceResume({ busy: true, marker: "finishing", persisted: true, visible: true }), "keep");
  assert.equal(googleChoiceResume({ busy: false, marker: "away", persisted: false, visible: false }), "keep");
});

test("double-click join claims the request once", () => {
  const lock = { held: false };
  assert.equal(claimJoinClick(lock), true);
  assert.equal(claimJoinClick(lock), false);
  assert.equal(lock.held, true);
});

test("Google cancelled copy only after a real return, not a failed start or a stale marker", () => {
  assert.equal(inviteShowsGoogleError({ returnedWithoutSession: false, startFailed: true }), false);
  assert.equal(inviteShowsGoogleError({ returnedWithoutSession: false, startFailed: false }), false);
  assert.equal(inviteShowsGoogleError({ returnedWithoutSession: true, startFailed: false }), true);
  assert.equal(shouldClearStaleGoogle("#/gabung?invite=TEST123", "away", "navigate"), true);
  assert.equal(shouldClearStaleGoogle("#/gabung?invite=TEST123", "finishing", "reload"), true);
  assert.equal(shouldClearStaleGoogle("#/gabung?invite=TEST123", "away", "back_forward"), false);
  assert.equal(shouldClearStaleGoogle("#/profil", "away", "navigate"), false);
  assert.equal(shouldClearStaleGoogle("#/gabung?invite=TEST123", null, "navigate"), false);
});

test("join errors stay in Indonesian", () => {
  assert.match(joinFailureMessage("seats_full"), /dua anggota/);
  assert.match(joinFailureMessage("invite_invalid"), /Tautan tidak valid atau sudah kedaluwarsa/);
  assert.equal(joinResultRoute("joined"), "pasangan");
  assert.equal(joinResultRoute("failed"), "stay");
  assert.equal(joinResultRoute("skipped"), "stay");
  assert.match(joinFailureMessage("not_ready"), /Masuk dulu/);
  assert.match(joinFailureMessage(""), /Cek koneksi/);
});

test("gabung state resets when the invite token changes", () => {
  const local = bag();
  const session = bag();
  const house = "Qa.vansken.prod.a+1019";
  const tokenA = "inviteAAAA";
  const tokenB = "inviteBBBB";
  const hashA = `#/gabung?invite=${tokenA}&dari=${encodeURIComponent(house)}`;
  const hashB = `#/gabung?invite=${tokenB}`;
  rememberInvite(tokenA, local.storage, session.storage, { name: house });
  assert.equal(houseNameForInvite(tokenA, hashA, local.storage, session.storage), house);
  assert.equal(joinConfirmCopy(houseNameForInvite(tokenA, hashA, local.storage, session.storage)), `Gabung ke rumah ${house}?`);

  const same = gabungOnTokenChange(tokenA, inviteParamFromHash(hashA), session.storage);
  assert.equal(same, null, "a dari change on the same token does not reset gabung");

  const next = gabungOnTokenChange(tokenA, inviteParamFromHash(hashB), session.storage);
  assert.equal(next?.token, tokenB);
  assert.equal(next?.phase, "checking");
  assert.equal(next?.joinCode, "");
  assert.equal(houseNameForInvite(tokenB, hashB, local.storage, session.storage), "");
  assert.equal(joinConfirmCopy(houseNameForInvite(tokenB, hashB, local.storage, session.storage)), "Gabung ke rumah ini?");
  assert.equal(joinConfirmCopy(houseNameForInvite(tokenB, hashB, local.storage, session.storage)).includes(house), false);
  const sheet = gabungSheetOpen({
    token: tokenB,
    phase: next?.phase ?? "ask",
    joinCode: next?.joinCode ?? "",
    signedIn: true,
    hasPartner: false,
    session: session.storage,
  });
  assert.equal(sheet, false, "the new token starts closed, without the previous house");
  assert.equal(houseNameForInvite(tokenA, hashA, local.storage, session.storage), house, "the previous token keeps its own name");
});

test("an invalid invite never opens the Gabung sheet", async () => {
  const session = bag();
  const signedIn = { signedIn: true, hasPartner: false, session: session.storage };
  const malformed = "short";
  const malformedPhase = gabungPhaseForToken(malformed, session.storage);
  assert.equal(malformedPhase.phase, "error");
  assert.equal(malformedPhase.joinCode, "invite_invalid");
  assert.equal(gabungSheetOpen({ token: malformed, phase: "ask", joinCode: "", ...signedIn }), false);
  assert.equal(gabungSheetOpen({ token: malformed, phase: malformedPhase.phase, joinCode: malformedPhase.joinCode, ...signedIn }), false);
  assert.equal((await fetchInvitePreview(malformed, session.storage)).status, "invalid");

  const cached = "invalidtoken123";
  rememberInviteInvalid(cached, session.storage);
  const cachedPhase = gabungPhaseForToken(cached, session.storage);
  assert.equal(cachedPhase.joinCode, "invite_invalid");
  assert.equal((await fetchInvitePreview(cached, session.storage)).status, "invalid");
  assert.equal(gabungAfterPreview("checking", { status: "invalid" }), "error");
  assert.equal(gabungSheetOpen({ token: cached, phase: "ask", joinCode: "", ...signedIn }), false);
  assert.equal(gabungSheetOpen({ token: cached, phase: "checking", joinCode: "", ...signedIn }), false);
  assert.equal(gabungSheetOpen({ token: cached, phase: "error", joinCode: "invite_invalid", ...signedIn }), false);

  const fresh = "inviteFresh1";
  const freshPhase = gabungPhaseForToken(fresh, session.storage);
  assert.equal(freshPhase.phase, "checking");
  assert.equal(gabungSheetOpen({ token: fresh, phase: freshPhase.phase, joinCode: freshPhase.joinCode, ...signedIn }), false);
  const preview = await fetchInvitePreview(fresh, session.storage);
  assert.equal(preview.status, "unknown");
  const after = gabungAfterPreview(freshPhase.phase, preview);
  assert.equal(after, "ask");
  assert.equal(gabungSheetOpen({ token: fresh, phase: after, joinCode: "", ...signedIn }), true);
});

test("preview maps invalid, full, and valid house names", () => {
  const base = { householdName: "Sari", seatsFilled: 1, seatsTotal: 2, full: false };
  assert.deepEqual(mapServerInvitePreview({ ...base, status: "expired" }), { status: "invalid" });
  assert.deepEqual(mapServerInvitePreview({ ...base, status: "used" }), { status: "invalid" });
  assert.deepEqual(mapServerInvitePreview({ ...base, status: "invalid", householdName: null }), { status: "invalid" });
  assert.deepEqual(mapServerInvitePreview({ ...base, status: "valid", full: true, seatsFilled: 2 }), { status: "full", houseName: "Sari" });
  assert.deepEqual(mapServerInvitePreview({ ...base, status: "valid" }), { status: "valid", houseName: "Sari" });
  assert.deepEqual(mapServerInvitePreview({ status: "valid", householdName: null, full: false }), { status: "valid" });
  assert.equal(mapServerInvitePreview(null), null);
  assert.equal(mapServerInvitePreview({ status: "nope" }), null);

  assert.equal(gabungAfterPreview("checking", { status: "invalid" }), "error");
  assert.equal(gabungAfterPreview("checking", { status: "full" }), "error");
  assert.equal(gabungAfterPreview("checking", { status: "valid", houseName: "Sari" }), "ask");
  assert.equal(gabungAfterPreview("joining", { status: "unknown" }), "joining");
  assert.equal(gabungAfterPreview("joining", { status: "invalid" }), "joining");
  assert.equal(gabungAfterPreview("joining", { status: "full" }), "joining");
  assert.equal(joinCodeAfterPreview("", { status: "full" }), "seats_full");
  assert.equal(joinCodeAfterPreview("", { status: "invalid" }), "invite_invalid");
  assert.equal(joinCodeAfterPreview("kept", { status: "valid", houseName: "Sari" }), "kept");

  const token = "A".repeat(24);
  const session = bag();
  const signedIn = { signedIn: true, hasPartner: false, session: session.storage };
  assert.equal(gabungSheetOpen({ token, phase: "error", joinCode: "seats_full", ...signedIn }), false);
  assert.equal(gabungSheetOpen({ token, phase: "ask", joinCode: "seats_full", ...signedIn }), false);
  assert.equal(gabungHouseName({ serverName: "Sari", fallbackName: "Dari", source: "server" }), "Sari");
  assert.equal(gabungHouseName({ serverName: "", fallbackName: "Dari", source: "server" }), "");
  assert.equal(gabungHouseName({ serverName: "", fallbackName: "Dari", source: "fallback" }), "Dari");
});

test("an expired invite is the invalid link screen", () => {
  const preview = mapServerInvitePreview({ status: "expired", householdName: null, full: false });
  assert.equal(preview?.status, "invalid");
  assert.equal(joinCodeAfterPreview("", preview!), "invite_invalid");
  assert.equal(gabungAfterPreview("checking", preview!), "error");
  assert.equal(INVITE_INVALID_TITLE, "Tautan tidak valid atau sudah kedaluwarsa");
  assert.deepEqual(gabungErrorActions("invite_invalid"), { back: true, retry: false });
});

test("only an owner of an open house may request an invite", () => {
  assert.deepEqual(householdInviteRequest({ settling: true, isOwner: true, full: false }), { ok: false, code: "household_settling" });
  assert.deepEqual(householdInviteRequest({ settling: false, isOwner: false, full: false }), { ok: false, code: "not_owner" });
  assert.deepEqual(householdInviteRequest({ settling: false, isOwner: true, full: true }), { ok: false, code: "seats_full" });
  assert.deepEqual(householdInviteRequest({ settling: false, isOwner: true, full: false }), { ok: true, path: "/household/invite", body: {} });
  assert.deepEqual(householdInviteRequest({ settling: false, isOwner: true, full: false, rotate: true }), { ok: true, path: "/household/invite?rotate=true", body: { rotate: true } });
});

test("your own join leaves for Pasangan instead of the already-paired screen", () => {
  assert.equal(gabungJoinScreen({ hasPartner: true, phase: "ask", ownJoin: false }), "connected");
  assert.equal(gabungJoinScreen({ hasPartner: true, phase: "joining", ownJoin: false }), "joining");
  assert.equal(gabungJoinScreen({ hasPartner: true, phase: "error", ownJoin: true }), "joining");
  assert.equal(gabungJoinScreen({ hasPartner: false, phase: "ask", ownJoin: false }), "continue");
});

test("a full house offers only Kembali", () => {
  assert.deepEqual(gabungErrorActions("seats_full"), { back: true, retry: false });
  assert.deepEqual(gabungErrorActions("invite_invalid"), { back: true, retry: false });
  assert.deepEqual(gabungErrorActions("timeout"), { back: false, retry: true });
  assert.deepEqual(gabungErrorActions("not_ready"), { back: false, retry: true });
  assert.match(joinFailureMessage("seats_full"), /dua anggota/);
});

test("Gabung never fails silently", () => {
  const token = "A".repeat(24);
  assert.equal(gabungClickResult({ token, lockHeld: false }).kind, "loading");
  assert.deepEqual(gabungClickResult({ token, lockHeld: false, result: { ok: "skipped" } }), { kind: "error", joinCode: "already_paired", lockHeld: false });
  assert.deepEqual(gabungClickResult({ token, lockHeld: false, result: { ok: "failed", code: "not_ready" } }), { kind: "error", joinCode: "not_ready", lockHeld: false });
  assert.deepEqual(gabungClickResult({ token, lockHeld: false, result: { ok: "timeout" } }), { kind: "error", joinCode: "timeout", lockHeld: false });
  assert.deepEqual(gabungClickResult({ token, lockHeld: false, result: { ok: "failed", code: "seats_full" } }), { kind: "error", joinCode: "seats_full", lockHeld: false });
  assert.equal(gabungClickResult({ token, lockHeld: false, result: { ok: "joined" } }).kind, "joined");
  assert.equal(gabungClickResult({ token, lockHeld: true, result: { ok: "failed", code: "not_ready" } }).kind, "ignore");
  assert.equal(gabungAfterJoin({ ok: "skipped" }).joined, false);
  assert.equal(isInviteToken(token), true);
});

test("Nanti leaves Gabung for Beranda and keeps the saved invite", () => {
  const local = bag();
  const session = bag();
  const now = Date.parse("2026-10-01T00:00:00Z");
  rememberInvite("inviteTok1", local.storage, session.storage, { at: now, accountId: "user-a", name: "Sari" });
  const next = declineJoin({ authReturn: "#/gabung?invite=inviteTok1" });
  assert.equal(next.hash, "#/");
  assert.equal(next.authReturn, null);
  assert.equal(readInvite(local.storage, session.storage, now), "inviteTok1");
  assert.equal(session.memory.get("bb_pending_invite"), "inviteTok1");
  assert.equal(declineJoin({ authReturn: "#/plus" }).authReturn, "#/plus");
  assert.equal(declineJoin({ authReturn: null }).authReturn, null);
});
