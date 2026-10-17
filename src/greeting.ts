/** Beranda greeting for the person who is signed in, never the household owner by default. */

const MOTHER_TITLE = "bunda";

export type GreetingMember = { id: string; name?: string | null; role?: string | null };
export type GreetingAccount = {
  user: { id: string; name?: string | null; email?: string | null };
  household?: { members?: GreetingMember[] | null } | null;
} | null;

function label(value?: string | null): string {
  const name = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!name) return "";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function emailLocal(email?: string | null): string {
  const local = email?.split("@")[0]?.trim() ?? "";
  return local && !local.includes(" ") ? local : "";
}

function isMotherTitle(name: string) {
  return name.toLocaleLowerCase("id") === MOTHER_TITLE;
}

function sameName(a: string, b: string) {
  return a.localeCompare(b, "id", { sensitivity: "accent" }) === 0;
}

function greet(name: string) {
  return name ? `Halo, ${name}` : "Halo!";
}

/**
 * Owner: nickname saved on this device, then the account's own name.
 * Partner: the account's own name or nickname, skipping the mother title and the owner's name.
 * Nothing usable: "Halo!".
 * momong-api only sends owner | member, so a missing name cannot become "Ayah".
 */
export function homeGreeting(me: GreetingAccount | undefined, profileName?: string | null): string {
  const profile = label(profileName);
  if (!me?.user?.id) return greet(profile);

  const members = me.household?.members ?? [];
  const self = members.find((member) => member.id === me.user.id);
  const accountNames = [label(me.user.name), label(self?.name), label(emailLocal(me.user.email))];
  if (self?.role === "owner") return greet(profile || accountNames.find(Boolean) || "");

  const ownerName = label(members.find((member) => member.role === "owner")?.name);
  const own = [...accountNames, profile].find((name) =>
    !!name && !isMotherTitle(name) && !(ownerName && sameName(name, ownerName)));
  return greet(own ?? "");
}
