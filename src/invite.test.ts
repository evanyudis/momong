import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearInvite, displayInviteCode, externalBrowserHref, inviteLinkWithOwner, inviteOwnerName, inviteReturnHash, inviteShowsGoogleError, inviteTokenFromInput, inviteWasSent,
  isAndroid, isSafeInviteReturn, isWhatsAppBrowser, joinConfirmCopy, joinFailureMessage, markInviteSent, pairSteps, readInvite, reconcilePendingInvite, rememberInvite, shouldClearStaleGoogle,
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
  const token = "abC123._~";
  assert.equal(inviteTokenFromInput(`https://momong.evanyudis.com/#/gabung?invite=${token}`), token);
  assert.equal(inviteTokenFromInput(`https://momong.evanyudis.com/gabung?invite=${token}`), token);
  assert.equal(inviteTokenFromInput(`  ${token}  `), token);
  assert.equal(inviteTokenFromInput("https://momong.evanyudis.com/#/gabung"), null);
  assert.equal(inviteTokenFromInput("javascript:alert(1)"), null);
  assert.equal(inviteTokenFromInput("short"), null);
  assert.equal(inviteTokenFromInput("has space"), null);
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
  assert.equal(readInvite(local.storage, session.storage, now + day), null);

  assert.equal(rememberInvite("inviteTok1", local.storage, session.storage, { at: now, name: "Sari" }), true);
  assert.equal(reconcilePendingInvite("user-b", now, local.storage, session.storage), "claimed");
  assert.equal(readInvite(local.storage, session.storage, now), "inviteTok1");
  assert.equal(local.storage.getItem("bb_pending_invite_user"), "user-b");

  assert.equal(rememberInvite("inviteTok1", local.storage, session.storage, { at: now, accountId: "user-b", name: "Sari" }), true);
  assert.equal(readInvite(local.storage, session.storage, now + 8 * day), null);
  assert.equal(local.storage.getItem("bb_pending_invite"), null);
});

test("confirm step names the household from the shared link", () => {
  const link = inviteLinkWithOwner("https://momong.evanyudis.com/#/gabung?invite=inviteTok1", "Sari");
  assert.equal(inviteOwnerName(link), "Sari");
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
  assert.match(joinFailureMessage("invite_invalid"), /tidak berlaku/);
  assert.match(joinFailureMessage("not_ready"), /Masuk dulu/);
  assert.match(joinFailureMessage(""), /Cek koneksi/);
});
