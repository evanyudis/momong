import { useSyncExternalStore } from "react";

/** Hash routing: works on any static host without rewrites. "#/log?x=1" → { path: "/log", params }. */
function parse() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  return { path, params: new URLSearchParams(query) };
}
let current = parse();
const listeners = new Set<() => void>();
window.addEventListener("hashchange", () => { current = parse(); window.scrollTo(0, 0); listeners.forEach((l) => l()); });
export const useRoute = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => current);
export const go = (hash: string) => { location.hash = hash; };
