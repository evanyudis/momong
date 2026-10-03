import { useAccount } from "./sync";

/** Display state for the partner/sync surfaces. */
export function useHousehold() {
  const acc = useAccount();
  const me = acc.me;
  const partner = me?.household.members.find((m) => m.id !== me.user.id);
  const name = (m?: { name: string; email: string }) => (m ? m.name || m.email.split("@")[0] : "");
  return {
    acc,
    signedIn: !!acc.token && !!me,
    me,
    partner,
    partnerName: name(partner),
    myName: name(me?.user),
    seatsUsed: me?.household.members.length ?? 1,
    seats: me?.household.seats ?? 2,
    isOwner: me?.household.members.find((m) => m.id === me.user.id)?.role === "owner",
  };
}

export const initial = (s: string) => (s.trim()[0] ?? "?").toUpperCase();
