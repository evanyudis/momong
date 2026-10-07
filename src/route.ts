import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { navigate } from "./motion";

const ALIASES: Record<string, string> = { "/pengaturan": "/profil" };
function parse() {
  let [path, query = ""] = (location.hash.replace(/^#/, "") || "/").split("?");
  if (ALIASES[path]) {
    path = ALIASES[path];
    history.replaceState(history.state, "", `#${path}${query ? `?${query}` : ""}`);
  }
  return { path, params: new URLSearchParams(query) };
}
type Visit = { id: number; hash: string; y: number; focus?: string; parent?: Visit };
let sequence = 0;
let current = parse();
let visit: Visit = { id: ++sequence, hash: location.hash || "#/", y: scrollY };
const visits = new Map([[visit.id, visit]]);
const listeners = new Set<() => void>();
let restore: Visit | undefined;
history.scrollRestoration = "manual";
history.replaceState({ ...history.state, momongVisit: visit.id }, "");
const onScroll = () => { visit.y = scrollY; };
const onClick = (e: MouseEvent) => {
  const link = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#/"]');
  if (link) { visit.y = scrollY; visit.focus = link.getAttribute("href")!; }
};
addEventListener("scroll", onScroll, { passive: true });
addEventListener("click", onClick, true);
const onHash = () => {
  const next = parse();
  const hash = location.hash || "#/";
  const previous = visit;
  const candidate = visits.get(history.state?.momongVisit);
  const traversed = candidate?.hash === hash ? candidate : undefined;
  const returning = traversed ?? (previous.parent?.hash === hash ? previous.parent : undefined);
  visit = traversed ?? { id: ++sequence, hash, y: returning?.y ?? 0, focus: returning?.focus, parent: returning ? returning.parent : previous };
  visits.set(visit.id, visit);
  history.replaceState({ ...history.state, momongVisit: visit.id }, "");
  restore = returning ?? visit;
  navigate(current.path, next.path, () => {
    current = next;
    flushSync(() => listeners.forEach((l) => l()));
  }, !!returning);
};
addEventListener("hashchange", onHash);

/** Called after React commits, before paint, including the native transition snapshot. */
export function restoreRoutePosition() {
  if (!restore) return;
  const target = restore;
  restore = undefined;
  window.scrollTo({ top: target.y, behavior: "instant" });
  const origin = target.focus && [...document.querySelectorAll<HTMLAnchorElement>('main a[href], nav a[href]')].find((a) => a.getAttribute("href") === target.focus);
  const heading = document.querySelector<HTMLElement>("main h1, main h2");
  if (origin) origin.focus({ preventScroll: true });
  else if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
}
export const useRoute = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => current);
export const go = (hash: string) => { location.hash = hash; };
import.meta.hot?.dispose(() => {
  removeEventListener("scroll", onScroll);
  removeEventListener("click", onClick, true);
  removeEventListener("hashchange", onHash);
});
