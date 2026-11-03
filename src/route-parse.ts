/**
 * Hash parsing that tolerates params a payment provider appends after our hash:
 * "#/plus?x=1", "#/plus&status=paid" and "#/plus?a=1&b=2" all resolve to path "/plus".
 */
export function parseHash(hash: string): { path: string; query: string } {
  const raw = hash.replace(/^#/, "") || "/";
  const cut = raw.search(/[?&]/);
  const path = (cut < 0 ? raw : raw.slice(0, cut)) || "/";
  return { path, query: cut < 0 ? "" : raw.slice(cut + 1) };
}

/** Drops ?payment_return=1 from the search part (the hash is kept). Null when there is nothing to strip. */
export function stripPaymentReturn(href: string): string | null {
  let url: URL;
  try { url = new URL(href); } catch { return null; }
  if (!url.searchParams.has("payment_return")) return null;
  url.searchParams.delete("payment_return");
  return url.pathname + url.search + url.hash;
}
