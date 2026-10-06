import { babyProfiles, getPrefs, isPlus, setPrefs } from "./store";
import { toast } from "./ui";

export type Reminder = { id: string; babyId: string; label: string; at: number; firedAt?: number };
export const dueReminders = (items: Reminder[], now = Date.now()) => items.filter((r) => r.firedAt === undefined && Number.isFinite(r.at) && r.at <= now);

export function startReminders() {
  function check() {
    if (!isPlus() || document.visibilityState !== "visible") return;
    const prefs = getPrefs(), due = dueReminders(prefs.reminders ?? []);
    if (!due.length) return;
    const ids = new Set(due.map((r) => r.id));
    setPrefs({ reminders: prefs.reminders!.map((r) => ids.has(r.id) ? { ...r, firedAt: Date.now() } : r) });
    const profiles = babyProfiles();
    const message = (r: Reminder) => `${profiles.find((baby) => baby.id === r.babyId)?.babyName || "Si kecil"}: ${r.label}`;
    toast(`Pengingat: ${due.map(message).join(" · ")}`);
    for (const reminder of due) {
      if (prefs.notifyReminders && "Notification" in window && Notification.permission === "granted") {
        try { new Notification("Momong · Pengingat", { body: message(reminder), tag: reminder.id }); } catch { /* in-app reminder remains available */ }
      }
    }
  }
  document.addEventListener("visibilitychange", check);
  const timer = setInterval(check, 15_000);
  check();
  return () => { clearInterval(timer); document.removeEventListener("visibilitychange", check); };
}
