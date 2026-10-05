import { getPrefs, isPlus, setPrefs } from "./store";
import { toast } from "./ui";

export type Reminder = { id: string; babyId: string; label: string; at: number; firedAt?: number };
export const dueReminders = (items: Reminder[], now = Date.now()) => items.filter((r) => !r.firedAt && r.at <= now);

export function startReminders() {
  function check() {
    if (!isPlus() || document.visibilityState !== "visible") return;
    const prefs = getPrefs(), due = dueReminders(prefs.reminders ?? []);
    if (!due.length) return;
    const ids = new Set(due.map((r) => r.id));
    setPrefs({ reminders: prefs.reminders!.map((r) => ids.has(r.id) ? { ...r, firedAt: Date.now() } : r) });
    for (const reminder of due) {
      toast(`Pengingat: ${reminder.label}`);
      if (prefs.notifyReminders && "Notification" in window && Notification.permission === "granted") {
        try { new Notification("BumpBuddy · Pengingat", { body: reminder.label, tag: reminder.id }); } catch { /* in-app reminder remains available */ }
      }
    }
  }
  document.addEventListener("visibilitychange", check);
  setInterval(check, 15_000);
  check();
}
