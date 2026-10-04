import { useSyncExternalStore } from "react";
import { beforeNavigate } from "./motion";

/** Hash routing: works on any static host without rewrites. "#/log?x=1" → { path: "/log", params }. */
// Old Settings page folded into Profil. Rewritten in place: no extra history entry, no transition.
const ALIASES: Record<string, string> = { "/pengaturan": "/profil" };

function parse() {
  const raw = location.hash.replace(/^#/, "") || "/";
  let [path, query = ""] = raw.split("?");
  if (ALIASES[path]) {
    path = ALIASES[path];
    history.replaceState(history.state, "", `#${path}${query ? `?${query}` : ""}`);
  }
  return { path, params: new URLSearchParams(query) };
}
let current = parse();
const listeners = new Set<() => void>();
window.addEventListener("hashchange", () => {
  const next = parse();
  beforeNavigate(current.path, next.path); // snapshot the old page before React swaps it
  current = next;
  window.scrollTo(0, 0);
  listeners.forEach((l) => l());
});
export const useRoute = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => current);
export const go = (hash: string) => { location.hash = hash; };
