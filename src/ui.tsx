import { PlusMesh } from "./PlusMesh";
import { PLUS_ENABLED } from "./release";
import { PlanPicker, selectedPlan } from "./billing";
import { Baby, Bell, CalendarDays, ChartNoAxesColumn, Check, ChevronLeft, FileText, Gift, History, Sparkles, Timer, Trash2, X } from "lucide-react";
import { type ComponentProps, type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePreventScroll } from "react-aria/usePreventScroll";
import { PLUS_COPY, PLUS_FEATURES, type PlusVariant } from "./content";
import { dayLabel } from "./dates";
import { animate, EASE_OUT, instantMotion, reducedMotion } from "./motion";

/**
 * Native date picker that fits its container: full width, value left-aligned, calendar glyph on the right.
 * Every native input prop passes through (value/onChange or defaultValue, min/max, required, aria-*, ref).
 */
export function DateInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <span className="date-input">
      <input {...props} type="date" className={className ? `input ${className}` : "input"} />
      <CalendarDays className="date-input-icon" size={20} aria-hidden="true" />
    </span>
  );
}

function useDialogFocus(open: boolean, root: { current: HTMLDivElement | null }, close: () => void, initialFocus?: RefObject<HTMLElement | null>) {
  usePreventScroll({ isDisabled: !open });
  const closeRef = useRef(close); closeRef.current = close;
  useEffect(() => {
    const dialog = root.current;
    if (!open || !dialog) return;
    return containDialogFocus(dialog, () => closeRef.current(), initialFocus?.current);
  }, [open, root, initialFocus]);
}

const dialogLocks = new Map<HTMLElement, { count: number; inert: boolean }>();
export function containDialogFocus(dialog: HTMLElement, close: () => void, initialFocus?: HTMLElement | null) {
  const previous = document.activeElement as HTMLElement | null;
  const background = [...document.querySelectorAll<HTMLElement>('#root, [role="dialog"]')].filter((el) => el !== dialog && !dialog.contains(el));
  background.forEach((el) => {
    const lock = dialogLocks.get(el) ?? { count: 0, inert: el.inert };
    lock.count++; dialogLocks.set(el, lock); el.inert = true;
  });
  const controls = () => [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter((el) => el.getClientRects().length && !el.closest('[inert], [aria-hidden="true"]'));
  (initialFocus ?? (matchMedia("(pointer: coarse)").matches ? dialog.querySelector<HTMLElement>("h3") ?? dialog : controls()[0] ?? dialog)).focus({ preventScroll: true });
  const key = (e: KeyboardEvent) => {
    if (dialog.inert) return;
    if (e.key === "Escape") { e.preventDefault(); close(); }
    if (e.key !== "Tab") return;
    const items = controls(), first = items[0], last = items[items.length - 1];
    if (!first) { e.preventDefault(); dialog.focus(); }
    else if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener("keydown", key);
  return () => {
    document.removeEventListener("keydown", key);
    background.forEach((el) => {
      const lock = dialogLocks.get(el)!;
      if (--lock.count === 0) { el.inert = lock.inert; dialogLocks.delete(el); }
    });
    if (previous?.isConnected) previous.focus({ preventScroll: true });
    else document.querySelector<HTMLElement>('[role="dialog"]:not([inert]) h3, main h1, main h2')?.focus({ preventScroll: true });
  };
}

/** Bottom sheet. Stays mounted through its exit so the slide-down can play. */
export function Sheet({ open, onOpenChange, title, children, initialFocus }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode; initialFocus?: RefObject<HTMLElement | null>;
}) {
  const root = useRef<HTMLDivElement>(null);
  const instant = useRef(false), previousOpen = useRef(false);
  if (open && !previousOpen.current) instant.current = !!document.activeElement?.matches(":focus-visible") || reducedMotion();
  previousOpen.current = open;
  const [mounted, setMounted] = useState(open);
  useDialogFocus(open && mounted, root, () => onOpenChange(false), initialFocus);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      let raf = requestAnimationFrame(() => { raf = requestAnimationFrame(() => setShown(true)); });
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), instant.current || reducedMotion() ? 0 : 200);
    return () => clearTimeout(t);
  }, [open]);
  if (!mounted) return null;
  return createPortal(
    <>
      <div className="sheet-backdrop" data-open={shown} data-instant={instant.current || reducedMotion()} onClick={() => onOpenChange(false)} />
      <div ref={root} tabIndex={-1} className="sheet" inert={!open} aria-hidden={!open} data-open={shown} data-instant={instant.current || reducedMotion()}
        onKeyDownCapture={() => { instant.current = true; root.current!.dataset.instant = "true"; }}
        role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-heading"><h3 tabIndex={-1}>{title}</h3><button type="button" className="icon-btn" aria-label="Tutup" onClick={() => onOpenChange(false)}><X size={20} /></button></div>
        {children}
      </div>
    </>,
    document.body,
  );
}

export function DeleteButton({ label, onDelete, children, className = "icon-btn" }: {
  label: string; onDelete: () => void; children?: ReactNode; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const cancel = useRef<HTMLButtonElement>(null);
  return <>
    <button type="button" className={className} aria-label={`Hapus ${label}`} aria-haspopup="dialog" onClick={() => { setError(""); setOpen(true); }}>{children ?? <Trash2 size={18} />}</button>
    <Sheet open={open} onOpenChange={setOpen} title="Hapus catatan?" initialFocus={cancel}>
      <div className="stack" style={{ marginTop: 16 }}>
        <p>Hapus {label}? Data yang dihapus tidak bisa dikembalikan.</p>
        {error && <p className="signin-error" role="alert">{error}</p>}
        <button ref={cancel} type="button" className="btn btn-soft block" onClick={() => setOpen(false)}>Batal</button>
        <button type="button" className="btn btn-danger-solid block" onClick={() => {
          try { onDelete(); setOpen(false); toast(`${label} dihapus`); }
          catch { setError("Belum bisa menghapus. Coba lagi."); }
        }}>Ya, hapus</button>
      </div>
    </Sheet>
  </>;
}

type Stage = "closed" | "compact" | "expanded";
type Motion = "none" | "enter" | "expand" | "collapse" | "exit";
const SETTLE: Record<Stage, Motion> = { closed: "exit", compact: "collapse", expanded: "expand" };
const EXIT_MS = 200; // matches [data-motion="exit"] in styles.css
const FEATURE_ICONS = [Timer, Bell, ChartNoAxesColumn, History, FileText, Gift, Baby];

/**
 * Plus soft paywall. Checkout lives on the Plus page.
 * A bottom sheet with a pinned purchase footer: tap or drag up expands, swipe down collapses, further down
 * dismisses. Transform + opacity only. Drag writes styles directly (no per-frame renders); on release a CSS
 * transition retargets from the live pose, so grabbing it mid-flight and reversing reverses the motion.
 */
export function PlusSheet({ variant, onClose }: { variant: PlusVariant | null; onClose: () => void }) {
  const [plan, setPlan] = useState(selectedPlan);
  const [last, setLast] = useState<PlusVariant>("insights");
  useEffect(() => { if (variant) setLast(variant); }, [variant]);
  const c = PLUS_COPY[variant ?? last]; // keep the copy through the exit
  const root = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(!!variant);
  useDialogFocus(!!variant && mounted, root, onClose);
  const [expanded, setExpanded] = useState(false);
  const backdrop = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const grip = useRef<HTMLButtonElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const foot = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage>("closed");
  const drag = useRef<{ y0: number; Y0: number; Y: number; y: number; t: number; v: number; moved: boolean } | null>(null);
  const swallowClick = useRef(false);
  const keyboard = useRef(false);
  const compactHeight = useRef(0);
  const view = useRef(false);
  const geometry = useRef({ H: 0, Yc: 1 });
  const planRects = useRef<{ el: HTMLElement; rect: DOMRect }[]>([]);
  const cancelPlans = useRef<(() => void)[]>([]);


  function measureCompact() {
    const el = root.current!, previous = el.dataset.expanded;
    el.dataset.expanded = "false";
    compactHeight.current = 54 + head.current!.offsetHeight + foot.current!.offsetHeight;
    el.dataset.expanded = previous;
    const H = panel.current!.offsetHeight;
    geometry.current = { H, Yc: Math.max(1, H - compactHeight.current) };
  }

  function showDetails(next: boolean) {
    if (view.current === next) return;
    planRects.current = stage.current !== "closed" && !keyboard.current && !instantMotion()
      ? Array.from(foot.current!.querySelectorAll<HTMLElement>(".plus-plan"), el => ({ el, rect: el.getBoundingClientRect() }))
      : [];
    cancelPlans.current.forEach(cancel => cancel());
    view.current = next;
    setExpanded(next);
  }

  // Y = the panel's translateY. Compact parks it so only head + footer show; expanded is Y = 0.
  function geo() {
    return geometry.current;
  }
  // One pose drives every layer, so panel, footer and backdrop always move as a unit.
  function place(Y: number, motion: Motion) {
    const { H, Yc } = geo();
    for (const el of [backdrop.current!, panel.current!, foot.current!]) el.dataset.motion = motion;
    root.current!.dataset.instant = String(keyboard.current || reducedMotion());
    panel.current!.style.transform = `translate(-50%, ${Y}px)`;
    foot.current!.style.transform = `translate(-50%, ${Math.max(0, Y - Yc)}px)`;
    backdrop.current!.style.opacity = String(Math.min(Math.max((H - Y) / (H - Yc), 0), 1));
  }
  function go(to: Stage, motion = SETTLE[to]) {
    stage.current = to;
    const { H, Yc } = geo();
    place(to === "expanded" ? 0 : to === "compact" ? Yc : H, motion);
    showDetails(to === "expanded");
    scroll.current!.style.maxHeight = `${Math.max(0, H - (to === "expanded" ? 0 : Yc) - foot.current!.offsetHeight - 54)}px`;
    if (to !== "expanded") scroll.current!.scrollTop = 0;
  }

  useLayoutEffect(() => {
    if (!mounted) return;
    keyboard.current = !!document.activeElement?.matches(":focus-visible");
    measureCompact();
    place(geo().H, "none");
    panel.current!.getBoundingClientRect(); // commit the off-screen pose so the enter transitions from it
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!mounted || stage.current === "closed") return;
    cancelPlans.current = planRects.current.map(({ el, rect }) => {
      const next = el.getBoundingClientRect();
      return animate(el, [
        { transform: `translate(${rect.x - next.x}px, ${rect.y - next.y}px) scale(${rect.width / next.width}, ${rect.height / next.height})` },
        { transform: "none" },
      ], expanded ? 280 : 210);
    });
    planRects.current = [];
    const { H, Yc } = geo();
    scroll.current!.style.maxHeight = `${Math.max(0, H - (expanded ? 0 : Yc) - foot.current!.offsetHeight - 54)}px`;
  }, [expanded, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => cancelPlans.current.forEach(cancel => cancel()), []);

  useEffect(() => {
    if (variant) {
      if (!mounted) setMounted(true);
      else if (stage.current === "closed") go("compact", "enter");
      return;
    }
    if (!mounted) return;
    go("closed");
    const t = setTimeout(() => setMounted(false), keyboard.current || reducedMotion() ? 0 : EXIT_MS);
    return () => clearTimeout(t);
  }, [variant, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mounted) return;
    const onResize = () => {
      measureCompact();
      if (!drag.current) go(stage.current, "none");
    };
    let size = `${panel.current!.offsetWidth}:${panel.current!.offsetHeight}`;
    const observer = new ResizeObserver(() => {
      const next = `${panel.current!.offsetWidth}:${panel.current!.offsetHeight}`;
      if (next !== size) { size = next; onResize(); }
    });
    observer.observe(panel.current!);
    addEventListener("resize", onResize);
    document.fonts.addEventListener("loadingdone", onResize);
    return () => { observer.disconnect(); removeEventListener("resize", onResize); document.fonts.removeEventListener("loadingdone", onResize); };
  }, [mounted, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || stage.current === "closed") return;
    swallowClick.current = false;
    keyboard.current = false;
    // Grab the sheet where it is right now, even mid-transition.
    const Y = new DOMMatrix(getComputedStyle(panel.current!).transform).f;
    place(Y, "none");
    grip.current!.setPointerCapture(e.pointerId);
    drag.current = { y0: e.clientY, Y0: Y, Y, y: e.clientY, t: e.timeStamp, v: 0, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y0;
    if (!d.moved && Math.abs(dy) < 6) return;
    d.moved = true;
    const { H, Yc } = geo();
    d.Y = Math.min(Math.max(d.Y0 + dy, 0), H);
    place(d.Y, "none");
    if (e.timeStamp > d.t) d.v = (e.clientY - d.y) / (e.timeStamp - d.t);
    d.y = e.clientY;
    d.t = e.timeStamp;
    showDetails(d.Y < Yc / 2);
  }
  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const from = stage.current;
    if (!d.moved) return go(from); // a tap: resume, then onClick toggles
    swallowClick.current = true;
    const { Yc } = geo();
    const v = e.timeStamp - d.t > 80 ? 0 : d.v; // a finger that stopped has no fling
    let to: Stage;
    if (v < -0.3) to = "expanded";
    else if (v > 0.3) to = from === "expanded" ? "compact" : "closed";
    else to = d.Y < Yc / 2 ? "expanded" : from === "expanded" || d.Y <= Yc + 60 ? "compact" : "closed";
    if (to === "closed") onClose();
    else go(to);
  }
  function onHeadClick(e: React.MouseEvent) {
    if (e.detail === 0) { keyboard.current = true; swallowClick.current = false; }
    if (swallowClick.current) { swallowClick.current = false; return; }
    go(stage.current === "expanded" ? "compact" : "expanded");
  }

  if (!mounted) return null;
  return createPortal(
    <div ref={root} tabIndex={-1} className="paywall" inert={!variant} aria-hidden={!variant} role="dialog" aria-modal="true" aria-label="Pilih paket Plus" data-expanded={expanded}
      onKeyDownCapture={() => { keyboard.current = true; root.current!.dataset.instant = "true"; }}
      onPointerDownCapture={() => { keyboard.current = false; root.current!.dataset.instant = String(reducedMotion()); }}>
      <div ref={backdrop} className="paywall-backdrop" onClick={onClose} />
      <div ref={panel} className="paywall-panel"><PlusMesh />
        <button type="button" ref={grip} className="paywall-grip" onClick={onHeadClick}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          onPointerCancel={() => { drag.current = null; swallowClick.current = true; go(stage.current, "none"); }}
          aria-expanded={expanded} aria-label={expanded ? "Ciutkan manfaat Plus" : "Lihat semua manfaat Plus"}><span /></button>
        <div ref={scroll} className="paywall-scroll">
          <div ref={head} className="paywall-head">
            <div className="paywall-title"><h3 tabIndex={-1}>Pilih paket Plus</h3><PlusBadge /></div>
            <p className="muted">Untuk malam-malam panjang: perkiraan, pengingat, dan grafik. Sinkron &amp; pasangan tetap gratis.</p>
            <ul className="paywall-checklist" aria-hidden={expanded}>
              {["Perkiraan menyusu", "Pengingat", "Grafik tren", "Riwayat > 30 hari", "PDF tanpa batas", "Wishlist & multi bayi"].map((label) => <li key={label}><span><Check size={11} aria-hidden="true" /></span><strong>{label}</strong></li>)}
            </ul>
          </div>
          <div className="paywall-benefits" inert={!expanded} aria-hidden={!expanded}>
            {(variant ?? last) !== "overview" && <p className="paywall-context muted">{c.body}</p>}
            <ul className="paywall-features">
              {PLUS_FEATURES.map((feature, i) => {
                const Icon = FEATURE_ICONS[i];
                return <li key={feature.title}>
                  <span className="paywall-feature-icon"><Icon size={21} strokeWidth={1.75} aria-hidden="true" /></span>
                  <div><h4>{feature.title}</h4><p className="muted">{feature.body}</p></div>
                </li>;
              })}
            </ul>
            {(variant ?? last) === "pdf" && (
              <div className="chart-preview">
                <div className="card-title" style={{ fontSize: 16 }}>Laporan 7 hari</div>
                <div className="card-sub">Menyusu, pompa, popok · PDF</div>
                <BlurBars />
              </div>
            )}
          </div>
        </div>
      </div>
      <div ref={foot} className="paywall-foot">
        {PLUS_ENABLED && <PlanPicker sheet value={plan} onChange={setPlan} />}
        {PLUS_ENABLED ? <a className="btn btn-coral lg block paywall-cta" href="#/plus" onClick={onClose}>Lanjut bayar · {plan === "plus_lifetime" ? "Lifetime" : "Bulanan"}</a> : <button className="btn btn-coral lg block paywall-cta" disabled>Segera hadir</button>}
        <p className="paywall-note">{PLUS_ENABLED ? <>Pembayaran lewat Midtrans · Sandbox.<br />Tidak ada uang nyata yang ditagih. Kamu bisa cek dulu sebelum bayar.</> : <>Fitur Plus sedang disiapkan.<br />Fitur gratis tetap bisa digunakan.</>}</p>
        <button type="button" className="paywall-later" onClick={onClose}>Nanti saja</button>
      </div>
    </div>,
    document.body,
  );
}

export function PlusBadge({ size = "large" }: { size?: "small" | "medium" | "large" }) {
  const compact = size === "small";
  return <span className={`plus-pill${compact ? "" : " plus-seal"}`} data-size={size}><span className="plus-badge-inner">
    {compact ? (<svg className="plus-badge-emblem" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <svg x="4.481" y="0" width="3.036" height="2.98" viewBox="-0.000004462897777557373 -0.0000027865171432495117 2.042805127799511 2.005384847521782" preserveAspectRatio="none"><path d="M0.91807 0.07528c-0.06545 0.42545-0.42764 0.78327-0.83346 0.83564-0.11782 0.01309-0.10909 0.17018 0.00437 0.18109 0.41891 0.05673 0.77891 0.42764 0.84218 0.83564 0.01527 0.10473 0.18109 0.10255 0.18982 0 0.06327-0.41891 0.42545-0.78982 0.83563-0.83782 0.11345-0.01309 0.11564-0.17236 0.00219-0.17891-0.42545-0.06327-0.79636-0.42982-0.84873-0.83564-0.01091-0.10255-0.17673-0.09818-0.192 0z" fill="currentColor" /></svg>
      <svg x="1.441" y="2.092" width="3.264" height="3.844" viewBox="0.0000020693987607955933 -0.0000031364616006612778 2.1959565449506044 2.586624420946464" preserveAspectRatio="none"><path d="M0.02066 0.12508c-0.05455 0.408-0.02618 1.14109 0.39927 1.70618 0.40145 0.52582 1.16945 0.72655 1.62327 0.75491 0.09164 0.00655 0.15273-0.05891 0.15273-0.15055 0.00218-0.432-0.12-1.06691-0.46909-1.51636-0.37091-0.48218-1.10618-0.82909-1.51418-0.91637-0.09382-0.01527-0.18109 0.03055-0.192 0.12219z" fill="currentColor" /></svg>
      <svg x="1.42" y="6.062" width="3.283" height="3.101" viewBox="0.000003948807716369629 0 2.2089642137289047 2.0868372917175293" preserveAspectRatio="none"><path d="M0.00007 0.15273c0.01309 0.36436 0.20073 0.98618 0.67418 1.45309 0.42327 0.41455 1.03418 0.50618 1.38982 0.47563 0.08291-0.00655 0.13309-0.06546 0.13745-0.15272 0.02836-0.36218-0.00436-0.92073-0.45818-1.37018-0.43418-0.432-1.19345-0.55855-1.60146-0.55855-0.09164 0-0.144 0.06109-0.14181 0.15273z" fill="currentColor" /></svg>
      <svg x="7.292" y="2.092" width="3.243" height="3.844" viewBox="1.341104507446289e-7 -0.0000031364616006612778 2.18196140229702 2.586624420946464" preserveAspectRatio="none"><path d="M2.16436 0.12508c0.048 0.39055 0.024 1.13455-0.41236 1.71927-0.40364 0.52145-1.2 0.71782-1.60145 0.74182-0.09164 0.00655-0.15055-0.05891-0.15055-0.15055 0-0.432 0.12655-1.08 0.49309-1.53382 0.39273-0.47782 1.14764-0.82036 1.49673-0.89891 0.09164-0.01527 0.16582 0.03055 0.17454 0.12219z" fill="currentColor" /></svg>
      <svg x="7.291" y="6.062" width="3.289" height="3.097" viewBox="0.0000051176175475120544 -1.1920928955078125e-7 2.2133783185854554 2.083953022956848" preserveAspectRatio="none"><path d="M2.21311 0.15273c-0.01527 0.384-0.216 1.01673-0.71781 1.48581-0.432 0.39709-1.04945 0.47564-1.35491 0.43637-0.08073-0.00873-0.12655-0.05891-0.13309-0.14837-0.02836-0.34909 0.00655-0.92509 0.46254-1.36799 0.46473-0.43855 1.23273-0.55855 1.59491-0.55855 0.10473 0.00218 0.15273 0.06109 0.14836 0.15273z" fill="currentColor" /></svg>
      <svg x="4.974" y="7.207" width="2.046" height="3.714" viewBox="0 8.903443813323975e-7 1.376729965209961 2.499311987310648" preserveAspectRatio="none"><path d="M0.6 0.0322c-0.23345 0.216-0.6 0.68073-0.6 1.25018 0 0.55854 0.36655 1.01236 0.60218 1.18691 0.05018 0.04146 0.11564 0.03927 0.16582-0.00218 0.24436-0.19855 0.60873-0.63054 0.60873-1.18254 0-0.58473-0.37527-1.06473-0.60655-1.25455-0.048-0.04145-0.12218-0.03927-0.17018 0.00218z" fill="currentColor" /></svg>
      <svg x="4.092" y="4.521" width="5.978" height="6.318" viewBox="-0.000003039836883544922 0.000003546476364135742 7.374384105205536 7.794060975313187" preserveAspectRatio="none"><path d="M7.04596 3.21616c-2.2275 0.0275-2.84075 1.6995-2.959 2.8325-0.0055 0.0605-0.06875 0.07425-0.09625 0.0165-0.33-0.73425-0.22275-1.87 0.088-2.5575 0.12375-0.27225 0.33825-0.4015 0.616-0.4675 1.4135-0.36575 1.9085-1.42725 1.81225-2.7775-0.011-0.2035-0.14575-0.28875-0.352-0.25575-1.034 0.198-2.05975 0.9295-2.1725 2.40625-0.022 0.3245-0.0495 0.60225-0.1815 0.869-0.48675 1.01475-0.4785 2.233-0.0715 3.2285 0.04675 0.12925-0.055 0.1705-0.13475 0.08525-0.22275-0.23375-0.34925-0.58575-0.40975-0.91025-0.31625-1.75175-1.4355-2.4145-2.85725-2.4585-0.23375-0.0055-0.3355 0.11275-0.32725 0.31625 0.06325 1.83425 1.04225 2.75275 2.64825 2.94525 0.25575 0.03575 0.4565 0.154 0.616 0.374 0.21175 0.297 0.462 0.58575 0.76725 0.792 0.25025 0.16225 0.59675 0.17325 0.82775 0.0825 0.16775-0.066 0.16775-0.30525 0.01925-0.40425-0.36025-0.25575-0.649-0.64625-0.7645-0.9845-0.011-0.033 0.01925-0.055 0.0495-0.04125 0.10175 0.0605 0.25025 0.0825 0.40975 0.077 1.881-0.066 2.7115-1.276 2.7995-2.849 0.01375-0.2145-0.0935-0.32175-0.32725-0.319z" fill="currentColor" /></svg>
      <svg x="4.767" y="4.519" width="2.099" height="2.509" viewBox="0.0000017872080206871033 -4.563480615615845e-8 2.588825107552111 3.094888255931437" preserveAspectRatio="none"><path d="M2.25841 3.09273c0.22275 0.01925 0.33-0.09075 0.33-0.31075 0.022-1.6005-0.82775-2.54925-2.2275-2.7775-0.22275-0.0275-0.3355 0.0715-0.34925 0.29975-0.12375 1.64725 0.74525 2.64 2.24675 2.7885z" fill="currentColor" /></svg>
      <svg x="5.954" y="2.345" width="2.236" height="2.22" viewBox="-2.2351741790771484e-7 8.940696716308594e-8 2.75824998319149 2.738999992609024" preserveAspectRatio="none"><path d="M0.132 1.507c0.64625 0.10175 1.023 0.4895 1.11375 1.09175 0.01375 0.09625 0.07425 0.14025 0.143 0.14025 0.06875 0 0.12925-0.044 0.143-0.14025 0.077-0.616 0.473-1.01475 1.0945-1.09175 0.099-0.01375 0.132-0.07425 0.132-0.14025 0-0.066-0.03575-0.121-0.132-0.1375-0.65725-0.077-1.0395-0.49775-1.10275-1.09725-0.00825-0.099-0.0715-0.132-0.143-0.132-0.066 0-0.12375 0.03575-0.1375 0.132-0.0715 0.6325-0.48675 1.023-1.10825 1.09725-0.10175 0.01375-0.13475 0.06875-0.13475 0.13475 0 0.0605 0.04125 0.12925 0.132 0.143z" fill="currentColor" /></svg>
      <svg x="7.68" y="1.369" width="1.546" height="1.515" viewBox="-0.000004954636096954346 -0.000004954636096954346 1.9075545743107796 1.869312472641468" preserveAspectRatio="none"><path d="M1.87687 0.88413c-0.209-0.06325-0.56375-0.18975-0.64075-0.2915-0.0935-0.1375-0.1925-0.40975-0.23375-0.56376-0.011-0.0385-0.0715-0.0385-0.08249 0-0.044 0.154-0.143 0.42625-0.23651 0.56376-0.077 0.10175-0.4675 0.23925-0.6545 0.28874-0.0385 0.011-0.0385 0.066 0 0.077 0.209 0.06325 0.5885 0.20625 0.65725 0.3135 0.0935 0.154 0.21175 0.4565 0.2585 0.57475 0.011 0.03025 0.0605 0.03025 0.06875 0 0.04675-0.12375 0.165-0.4235 0.2585-0.57475 0.0605-0.10175 0.4455-0.253 0.6105-0.31074 0.03575-0.011 0.033-0.066-0.0055-0.077z" fill="currentColor" /></svg>
      <svg x="7.705" y="3.12" width="1.368" height="2.635" viewBox="0.000005148351192474365 0.0000018104910850524902 1.6873512044548988 3.2507763877511024" preserveAspectRatio="none"><path d="M1.31291 0.01707c-0.39875 0.28325-1.10275 0.76175-1.2705 1.60875-0.12925 0.63525 0.06875 1.31175 0.17049 1.57025 0.02475 0.05775 0.10175 0.0715 0.15126 0.033 0.2805-0.22 0.9625-0.759 1.20175-1.41075 0.253-0.704 0.05775-1.4795-0.10725-1.7765-0.022-0.044-0.09625-0.055-0.14575-0.02475z" fill="currentColor" /></svg>
      <svg x="6.251" y="4.677" width="1.311" height="2.76" viewBox="-7.152557373046875e-7 -0.000002316199243068695 1.6179428100585938 3.4044315135106444" preserveAspectRatio="none"><path d="M0.54878 0.02975c-0.2255 0.23925-0.57475 0.7975-0.54725 1.52625 0.03025 0.8635 0.6875 1.52625 1.012 1.82325 0.0495 0.044 0.12925 0.0275 0.16225-0.0275 0.176-0.29975 0.47025-0.93775 0.44-1.628-0.033-0.9075-0.627-1.5565-0.94325-1.716-0.0385-0.0165-0.0935-0.0055-0.12375 0.022z" fill="currentColor" /></svg>
      <svg x="7.275" y="5.984" width="2.105" height="2.039" viewBox="0.0000017807178664952517 -0.0000011837109923362732 2.5964006259746384 2.51569317933172" preserveAspectRatio="none"><path d="M2.50003 0.01197c-0.396-0.04125-1.16875-0.00275-1.76825 0.5555-0.56925 0.53075-0.6985 1.48225-0.7315 1.826-0.0055 0.0825 0.0715 0.143 0.14575 0.1155 0.39875-0.1375 1.2265-0.4455 1.7545-0.9955 0.506-0.5225 0.69025-1.144 0.69575-1.3915 0.00275-0.05775-0.04125-0.1045-0.09625-0.11z" fill="currentColor" /></svg>
      <svg x="5.306" y="6.916" width="1.419" height="2.76" viewBox="0.0000016093254089355469 0.000003778841346502304 1.7509021162986755 3.4053445220924914" preserveAspectRatio="none"><path d="M0.41417 0.04683c-0.21175 0.297-0.50875 0.913-0.385 1.62525 0.13475 0.836 0.87725 1.46575 1.188 1.7105 0.05225 0.04125 0.132 0.02475 0.16225-0.03575 0.15675-0.308 0.43725-0.968 0.3575-1.62525-0.1045-0.935-0.79475-1.5675-1.18525-1.716-0.044-0.0165-0.10725 0.0055-0.1375 0.04125z" fill="currentColor" /></svg>
      <svg x="4.416" y="8.288" width="4.428" height="3.712" viewBox="-0.000002473592758178711 -0.00000476837158203125 5.462411016225815 4.578725814819336" preserveAspectRatio="none"><path d="M5.351 0.05645c-0.36575-0.07975-1.11925-0.1485-1.804 0.33825-0.583 0.418-0.84975 1.2155-1.001 1.749-0.154 0.56375-0.44275 1.09725-0.62975 1.32001 0.01925-0.33825-0.00825-0.84425-0.286-1.35301-0.34375-0.6215-1.001-0.9405-1.2815-1.001-0.044-0.00825-0.0935 0.0165-0.11 0.05501-0.143 0.275-0.3465 0.88-0.1705 1.55649 0.19525 0.7865 0.88275 1.21825 1.2045 1.34476 0.03025 0.011 0.03025 0.04675 0.011 0.06875-0.0825 0.11-0.253 0.1925-0.3575 0.25574-0.0825 0.055-0.044 0.2035 0.10725 0.187 0.737-0.10175 1.54-1.287 1.86725-2.0845 0.05225-0.13475 0.16775-0.22275 0.308-0.26125 0.39325-0.11 1.045-0.34375 1.5345-0.81674 0.47575-0.4675 0.671-1.02575 0.71775-1.22101 0.011-0.06325-0.044-0.12375-0.11-0.1375z" fill="currentColor" /></svg>
    </svg>) : (<svg className="plus-badge-emblem" viewBox="0 0 22 22" aria-hidden="true" focusable="false">
      <svg x="4.815" y="6.523" width="12.371" height="13.075" viewBox="-0.000003039836883544922 0.000003546476364135742 7.374384105205536 7.794060975313187" preserveAspectRatio="none"><path d="M7.04596 3.21616c-2.2275 0.0275-2.84075 1.6995-2.959 2.8325-0.0055 0.0605-0.06875 0.07425-0.09625 0.0165-0.33-0.73425-0.22275-1.87 0.088-2.5575 0.12375-0.27225 0.33825-0.4015 0.616-0.4675 1.4135-0.36575 1.9085-1.42725 1.81225-2.7775-0.011-0.2035-0.14575-0.28875-0.352-0.25575-1.034 0.198-2.05975 0.9295-2.1725 2.40625-0.022 0.3245-0.0495 0.60225-0.1815 0.869-0.48675 1.01475-0.4785 2.233-0.0715 3.2285 0.04675 0.12925-0.055 0.1705-0.13475 0.08525-0.22275-0.23375-0.34925-0.58575-0.40975-0.91025-0.31625-1.75175-1.4355-2.4145-2.85725-2.4585-0.23375-0.0055-0.3355 0.11275-0.32725 0.31625 0.06325 1.83425 1.04225 2.75275 2.64825 2.94525 0.25575 0.03575 0.4565 0.154 0.616 0.374 0.21175 0.297 0.462 0.58575 0.76725 0.792 0.25025 0.16225 0.59675 0.17325 0.82775 0.0825 0.16775-0.066 0.16775-0.30525 0.01925-0.40425-0.36025-0.25575-0.649-0.64625-0.7645-0.9845-0.011-0.033 0.01925-0.055 0.0495-0.04125 0.10175 0.0605 0.25025 0.0825 0.40975 0.077 1.881-0.066 2.7115-1.276 2.7995-2.849 0.01375-0.2145-0.0935-0.32175-0.32725-0.319z" fill="currentColor" /></svg>
      <svg x="6.212" y="6.518" width="4.343" height="5.192" viewBox="0.0000017872080206871033 -4.563480615615845e-8 2.588825107552111 3.094888255931437" preserveAspectRatio="none"><path d="M2.25841 3.09273c0.22275 0.01925 0.33-0.09075 0.33-0.31075 0.022-1.6005-0.82775-2.54925-2.2275-2.7775-0.22275-0.0275-0.3355 0.0715-0.34925 0.29975-0.12375 1.64725 0.74525 2.64 2.24675 2.7885z" fill="currentColor" /></svg>
      <svg x="8.668" y="2.018" width="4.627" height="4.595" viewBox="-2.2351741790771484e-7 8.940696716308594e-8 2.75824998319149 2.738999992609024" preserveAspectRatio="none"><path d="M0.132 1.507c0.64625 0.10175 1.023 0.4895 1.11375 1.09175 0.01375 0.09625 0.07425 0.14025 0.143 0.14025 0.06875 0 0.12925-0.044 0.143-0.14025 0.077-0.616 0.473-1.01475 1.0945-1.09175 0.099-0.01375 0.132-0.07425 0.132-0.14025 0-0.066-0.03575-0.121-0.132-0.1375-0.65725-0.077-1.0395-0.49775-1.10275-1.09725-0.00825-0.099-0.0715-0.132-0.143-0.132-0.066 0-0.12375 0.03575-0.1375 0.132-0.0715 0.6325-0.48675 1.023-1.10825 1.09725-0.10175 0.01375-0.13475 0.06875-0.13475 0.13475 0 0.0605 0.04125 0.12925 0.132 0.143z" fill="currentColor" /></svg>
      <svg x="12.24" y="0" width="3.2" height="3.136" viewBox="-0.000004954636096954346 -0.000004954636096954346 1.9075545743107796 1.869312472641468" preserveAspectRatio="none"><path d="M1.87687 0.88413c-0.209-0.06325-0.56375-0.18975-0.64075-0.2915-0.0935-0.1375-0.1925-0.40975-0.23375-0.56376-0.011-0.0385-0.0715-0.0385-0.08249 0-0.044 0.154-0.143 0.42625-0.23651 0.56376-0.077 0.10175-0.4675 0.23925-0.6545 0.28874-0.0385 0.011-0.0385 0.066 0 0.077 0.209 0.06325 0.5885 0.20625 0.65725 0.3135 0.0935 0.154 0.21175 0.4565 0.2585 0.57475 0.011 0.03025 0.0605 0.03025 0.06875 0 0.04675-0.12375 0.165-0.4235 0.2585-0.57475 0.0605-0.10175 0.4455-0.253 0.6105-0.31074 0.03575-0.011 0.033-0.066-0.0055-0.077z" fill="currentColor" /></svg>
      <svg x="12.292" y="3.623" width="2.831" height="5.453" viewBox="0.000005148351192474365 0.0000018104910850524902 1.6873512044548988 3.2507763877511024" preserveAspectRatio="none"><path d="M1.31291 0.01707c-0.39875 0.28325-1.10275 0.76175-1.2705 1.60875-0.12925 0.63525 0.06875 1.31175 0.17049 1.57025 0.02475 0.05775 0.10175 0.0715 0.15126 0.033 0.2805-0.22 0.9625-0.759 1.20175-1.41075 0.253-0.704 0.05775-1.4795-0.10725-1.7765-0.022-0.044-0.09625-0.055-0.14575-0.02475z" fill="currentColor" /></svg>
      <svg x="9.283" y="6.844" width="2.714" height="5.711" viewBox="-7.152557373046875e-7 -0.000002316199243068695 1.6179428100585938 3.4044315135106444" preserveAspectRatio="none"><path d="M0.54878 0.02975c-0.2255 0.23925-0.57475 0.7975-0.54725 1.52625 0.03025 0.8635 0.6875 1.52625 1.012 1.82325 0.0495 0.044 0.12925 0.0275 0.16225-0.0275 0.176-0.29975 0.47025-0.93775 0.44-1.628-0.033-0.9075-0.627-1.5565-0.94325-1.716-0.0385-0.0165-0.0935-0.0055-0.12375 0.022z" fill="currentColor" /></svg>
      <svg x="11.403" y="9.55" width="4.356" height="4.22" viewBox="0.0000017807178664952517 -0.0000011837109923362732 2.5964006259746384 2.51569317933172" preserveAspectRatio="none"><path d="M2.50003 0.01197c-0.396-0.04125-1.16875-0.00275-1.76825 0.5555-0.56925 0.53075-0.6985 1.48225-0.7315 1.826-0.0055 0.0825 0.0715 0.143 0.14575 0.1155 0.39875-0.1375 1.2265-0.4455 1.7545-0.9955 0.506-0.5225 0.69025-1.144 0.69575-1.3915 0.00275-0.05775-0.04125-0.1045-0.09625-0.11z" fill="currentColor" /></svg>
      <svg x="7.327" y="11.48" width="2.937" height="5.712" viewBox="0.0000016093254089355469 0.000003778841346502304 1.7509021162986755 3.4053445220924914" preserveAspectRatio="none"><path d="M0.41417 0.04683c-0.21175 0.297-0.50875 0.913-0.385 1.62525 0.13475 0.836 0.87725 1.46575 1.188 1.7105 0.05225 0.04125 0.132 0.02475 0.16225-0.03575 0.15675-0.308 0.43725-0.968 0.3575-1.62525-0.1045-0.935-0.79475-1.5675-1.18525-1.716-0.044-0.0165-0.10725 0.0055-0.1375 0.04125z" fill="currentColor" /></svg>
      <svg x="5.485" y="14.319" width="9.163" height="7.681" viewBox="-0.000002473592758178711 -0.00000476837158203125 5.462411016225815 4.578725814819336" preserveAspectRatio="none"><path d="M5.351 0.05645c-0.36575-0.07975-1.11925-0.1485-1.804 0.33825-0.583 0.418-0.84975 1.2155-1.001 1.749-0.154 0.56375-0.44275 1.09725-0.62975 1.32001 0.01925-0.33825-0.00825-0.84425-0.286-1.35301-0.34375-0.6215-1.001-0.9405-1.2815-1.001-0.044-0.00825-0.0935 0.0165-0.11 0.05501-0.143 0.275-0.3465 0.88-0.1705 1.55649 0.19525 0.7865 0.88275 1.21825 1.2045 1.34476 0.03025 0.011 0.03025 0.04675 0.011 0.06875-0.0825 0.11-0.253 0.1925-0.3575 0.25574-0.0825 0.055-0.044 0.2035 0.10725 0.187 0.737-0.10175 1.54-1.287 1.86725-2.0845 0.05225-0.13475 0.16775-0.22275 0.308-0.26125 0.39325-0.11 1.045-0.34375 1.5345-0.81674 0.47575-0.4675 0.671-1.02575 0.71775-1.22101 0.011-0.06325-0.044-0.12375-0.11-0.1375z" fill="currentColor" /></svg>
    </svg>)}
    <span>Plus</span></span></span>;
}

/** Small coral "Plus" label: paywall title, Insight preview. */
export function PlusPill() {
  return <PlusBadge size="small" />;
}

const BARS = [42, 68, 55, 82, 60, 74, 92]; // ponytail: fixed shape; a teaser, never real data
/** Static blurred bar chart: hints at what Plus draws without showing data. */
export function BlurBars() {
  return (
    <div className="blur-bars" aria-hidden="true">
      {BARS.map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}
    </div>
  );
}

export function Header({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <header className="header">
      <p className="date">{dayLabel()}</p>
      <div className="spread">
        <h1>{title}</h1>
        {aside}
      </div>
    </header>
  );
}

export function TopBar({ title, back = "#/" }: { title: string; back?: string }) {
  return (
    <div className="topbar">
      <a className="icon-btn" href={back} aria-label="Kembali"><ChevronLeft size={22} /></a>
      <h2>{title}</h2>
      <span />
    </div>
  );
}

/** Progress ring; `value` 0–1. Gradient matches the couple accents. */
export function Ring({ value, size = 150, stroke = 12, knob, children }: { value: number; size?: number; stroke?: number; knob?: boolean; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const id = `g${size}`;
  const v = Math.min(Math.max(value, 0), 1);
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7EB8D4" />
            <stop offset="60%" stopColor="#B8A8D4" />
            <stop offset="100%" stopColor="#E8A0A8" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-sunk)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)}
        />
        {knob && v > 0.02 && (
          <g style={{ transformOrigin: `${size / 2}px ${size / 2}px`, transform: `rotate(${v * 360}deg)` }}>
            <circle cx={size / 2 + r} cy={size / 2} r={stroke * 0.9} fill="#E8A0A8" stroke="var(--surface)" strokeWidth={3} />
          </g>
        )}
      </svg>
      <div className="center">{children}</div>
    </div>
  );
}

// Tiny global toast.
let toastMsg: { message: string; celebrate: boolean } | null = null;
const toastListeners = new Set<() => void>();
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let toastRemaining = 0;
let toastStarted = 0;
function resumeToast() {
  if (!toastMsg || document.hidden) return;
  toastStarted = Date.now();
  toastTimer = setTimeout(() => { toastMsg = null; toastListeners.forEach((l) => l()); }, toastRemaining);
}
export function toast(msg: string, celebrate = false) {
  toastMsg = msg ? { message: msg, celebrate } : null;
  toastListeners.forEach((l) => l());
  clearTimeout(toastTimer);
  toastRemaining = Math.max(3000, msg.split(/\s+/).length * 300);
  resumeToast();
}
export function Toaster() {
  const msg = useSyncExternalStore((l) => { toastListeners.add(l); return () => toastListeners.delete(l); }, () => toastMsg);
  // Stays mounted so the exit can play; visibility is an interruptible transition.
  const [text, setText] = useState<typeof toastMsg>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const changed = () => {
      if (document.hidden) {
        clearTimeout(toastTimer);
        toastRemaining = Math.max(0, toastRemaining - (Date.now() - toastStarted));
      } else resumeToast();
    };
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, []);
  useEffect(() => {
    if (!msg) { setVisible(false); return; }
    setText(msg);
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [msg]);
  return <>
    <div role="status" className="visually-hidden">{msg?.message ?? ""}</div>
    <div className="toast" aria-hidden="true" data-instant={instantMotion()} data-visible={visible}>{text?.celebrate && <Check className="success-check" size={22} />}{text?.message}</div>
  </>;
}
