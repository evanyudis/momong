import { midnight, todayISO } from "./dates";
import { nameFromEmail } from "./signin";
import { saveSettings, setPrefs, type Settings } from "./store";

export const motherNameFromAccount = (user: { name: string; email: string }) =>
  user.name.trim() || nameFromEmail(user.email);

export function onboardingStep(s: Settings, account: { token: string | null; me: unknown; checking?: boolean; restoreError?: boolean }, guest = false) {
  if (s.birthMode === "postpartum" || s.hpl) return "ready";
  if (account.token && account.checking) return "restoring";
  if (account.token && account.restoreError) return "restore-error";
  return guest || (account.token && account.me) ? "setup" : "signin";
}

export function saveOnboarding({ mode, name, hpl, babyName, babyBirth }: {
  mode: Settings["birthMode"]; name: string; hpl: string; babyName: string; babyBirth: string;
}) {
  const date = mode === "pregnant" ? hpl : babyBirth;
  if (!mode || !name.trim() || !date || todayISO(new Date(midnight(date))) !== date) return false;
  if (mode === "postpartum" && (!babyName.trim() || babyBirth > todayISO())) return false;
  setPrefs({ name: name.trim() });
  saveSettings(mode === "pregnant"
    ? { birthMode: mode, hpl }
    : { birthMode: mode, babyBirth, babyName: babyName.trim() });
  return true;
}
