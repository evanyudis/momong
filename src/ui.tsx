import { PlusBadge } from "./PlusBadge";
export { PlusBadge } from "./PlusBadge";
import { PlusMesh } from "./PlusMesh";
import { PLUS_ENABLED } from "./release";
import { PlanPicker, selectedPlan } from "./billing";
import { Baby, Bell, CalendarDays, ChartNoAxesColumn, CircleCheck, CircleAlert, Info, Check, ChevronLeft, FileText, Gift, History, Sparkles, Timer, Trash2, X } from "lucide-react";
import { type ComponentProps, type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Toaster as SonnerToaster } from "sonner";
import { toast } from "./toast";
export { toast } from "./toast";
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
  if (open && !previousOpen.current) instant.current = instantMotion();
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
        onPointerDownCapture={() => { instant.current = reducedMotion(); root.current!.dataset.instant = String(instant.current); }}
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
    keyboard.current = instantMotion();
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

export function Toaster({ aboveNavigation = false }: { aboveNavigation?: boolean }) {
  const offset = {
    bottom: `calc(env(safe-area-inset-bottom) + ${aboveNavigation ? 104 : 24}px)`,
    left: "max(16px, env(safe-area-inset-left))",
    right: "max(16px, env(safe-area-inset-right))",
  };
  return createPortal(<SonnerToaster
    className="momong-toaster" position="bottom-center" offset={offset} mobileOffset={offset}
    closeButton visibleToasts={3} gap={10} containerAriaLabel="Notifikasi" customAriaLabel="Notifikasi (Alt+T)"
    toastOptions={{ classNames: { toast: "momong-toast" }, closeButtonAriaLabel: "Tutup notifikasi" }}
    icons={{ success: <CircleCheck size={20} aria-hidden="true" />, error: <CircleAlert size={20} aria-hidden="true" />, info: <Info size={20} aria-hidden="true" />, close: <X size={18} aria-hidden="true" /> }}
  />, document.body);
}
