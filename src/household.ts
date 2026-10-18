import { useAccount, type Me } from "./sync";

/** Kursi keluarga label. Source is that member on GET /me: the saved name, or the Google account name if they never saved one. */
export function seatNameFromMember(member?: { name?: string | null; email?: string | null } | null) {
  const saved = member?.name?.trim() || "";
  const raw = saved || member?.email?.trim().split("@")[0] || "";
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "";
}

export function seatNames(me: Me | null | undefined) {
  const partner = me?.household.members.find((m) => m.id !== me.user.id);
  return { self: seatNameFromMember(me?.user), partner: seatNameFromMember(partner) };
}

/**
 * Pasangan body. Local flag or cursor decides; /me is not required.
 * `wait` is the placeholder while the account id is still unknown.
 */
export function partnerSyncScreen(input: {
  hasToken: boolean;
  userId: string | null;
  enabledFlag: boolean | null;
  syncCursor: number;
}): "signin" | "wait" | "consent" | "household" {
  if (!input.hasToken) return "signin";
  if (!input.userId) return "wait";
  const cursor = Number.isFinite(input.syncCursor) && input.syncCursor > 0;
  if (input.enabledFlag === true || cursor) return "household";
  return "consent";
}

/** Display state for the partner/sync surfaces. */
export function useHousehold() {
  const acc = useAccount();
  const me = acc.me;
  const names = seatNames(me);
  return {
    acc,
    signedIn: !!acc.token && !!me,
    me,
    partner: me?.household.members.find((m) => m.id !== me.user.id),
    partnerName: names.partner,
    myName: names.self,
    seatsUsed: me?.household.members.length ?? 1,
    seats: me?.household.seats ?? 2,
    isOwner: me?.household.members.find((m) => m.id === me.user.id)?.role === "owner",
  };
}

export const initial = (s: string) => (s.trim()[0] ?? "?").toUpperCase();
