import { PlanPicker, selectedPlan } from "./billing";
import { Baby, Bell, CalendarDays, ChartNoAxesColumn, Check, ChevronLeft, FileText, Gift, History, Sparkles, Timer } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { PLUS_COPY, PLUS_FEATURES, type PlusVariant } from "./content";
import { dayLabel } from "./dates";
import { EASE_OUT, reducedMotion } from "./motion";

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

function useDialogFocus(open: boolean, root: { current: HTMLDivElement | null }, close: () => void) {
  const closeRef = useRef(close); closeRef.current = close;
  useEffect(() => {
    const dialog = root.current;
    if (!open || !dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = [document.documentElement, document.body].map((el) => ({ el, value: el.style.overflow }));
    overflow.forEach(({ el }) => { el.style.overflow = "hidden"; });
    const background = [...document.querySelectorAll<HTMLElement>("main.app, nav.tabbar")].map((el) => ({ el, inert: el.inert }));
    background.forEach(({ el }) => { el.inert = true; });
    const controls = () => [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter((el) => el.getClientRects().length && !el.closest('[inert], [aria-hidden="true"]'));
    (controls()[0] ?? dialog).focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); closeRef.current(); }
      if (e.key !== "Tab") return;
      const items = controls(), first = items[0], last = items[items.length - 1];
      if (!first) { e.preventDefault(); dialog.focus(); }
      else if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      background.forEach(({ el, inert }) => { el.inert = inert; });
      overflow.forEach(({ el, value }) => { el.style.overflow = value; });
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, root]);
}

/** Bottom sheet. Stays mounted through its exit so the slide-down can play. */
export function Sheet({ open, onOpenChange, title, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const instant = useRef(false), previousOpen = useRef(false);
  if (open && !previousOpen.current) instant.current = !!document.activeElement?.matches(":focus-visible") || reducedMotion();
  previousOpen.current = open;
  const [mounted, setMounted] = useState(open);
  useDialogFocus(open && mounted, root, () => onOpenChange(false));
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
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
        <div className="sheet-grip" />
        <h3>{title}</h3>
        {children}
      </div>
    </>,
    document.body,
  );
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
  const morphFrom = useRef(new Map<string, DOMRect>());
  const morphs = useRef<Animation[]>([]);

  function measureCompact() {
    const el = root.current!, previous = el.dataset.expanded;
    el.dataset.expanded = "false";
    compactHeight.current = 54 + head.current!.offsetHeight + foot.current!.offsetHeight;
    el.dataset.expanded = previous;
  }

  function showDetails(next: boolean) {
    if (view.current === next) return;
    const list = root.current!.querySelector(next ? ".paywall-checklist" : ".paywall-features")!;
    morphFrom.current = new Map([...list.querySelectorAll<HTMLElement>("[data-plus-morph]")].map(el => [el.dataset.plusMorph!, el.getBoundingClientRect()]));
    foot.current!.querySelectorAll<HTMLElement>(".plus-plan").forEach((el, i) => morphFrom.current.set(`plan-${i}`, el.getBoundingClientRect()));
    morphs.current.forEach(animation => animation.cancel());
    view.current = next;
    setExpanded(next);
  }

  // Y = the panel's translateY. Compact parks it so only head + footer show; expanded is Y = 0.
  function geo() {
    const H = panel.current!.offsetHeight;
    const Yc = Math.max(1, H - compactHeight.current);
    return { H, Yc };
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
    const { H, Yc } = geo();
    scroll.current!.style.maxHeight = `${Math.max(0, H - (expanded ? 0 : Yc) - foot.current!.offsetHeight - 54)}px`;
    const from = morphFrom.current;
    morphFrom.current = new Map();
    if (keyboard.current || reducedMotion() || !from.size) return;
    const duration = expanded ? 280 : 210;
    const list = root.current!.querySelector(expanded ? ".paywall-features" : ".paywall-checklist")!;
    const animations = [...list.querySelectorAll<HTMLElement>("[data-plus-morph]")].map(el => {
      const before = from.get(el.dataset.plusMorph!), after = el.getBoundingClientRect();
      return el.animate(before ? [
        { transform: `translate(${before.x - after.x}px, ${before.y - after.y}px) scale(${before.height / after.height})`, opacity: 1 },
        { transform: "none", opacity: 1 },
      ] : [{ transform: "translateY(8px)", opacity: 0 }, { transform: "none", opacity: 1 }],
      { duration, easing: "cubic-bezier(0.645, 0.045, 0.355, 1)" });
    });
    if (expanded) list.querySelectorAll("p").forEach(el => animations.push(el.animate(
      [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
      { duration: 180, delay: 60, easing: EASE_OUT, fill: "backwards" },
    )));
    foot.current!.querySelectorAll<HTMLElement>(".plus-plan").forEach((el, i) => {
      const before = from.get(`plan-${i}`)!, after = el.getBoundingClientRect();
      animations.push(el.animate(
        [{ transform: `translate(${before.x - after.x}px, ${before.y - after.y}px)`, opacity: .6 }, { transform: "none", opacity: 1 }],
        { duration, easing: EASE_OUT },
      ));
    });
    morphs.current = animations;
  }, [expanded, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => { morphs.current.forEach(animation => animation.cancel()); };
    media.addEventListener("change", stop);
    return () => { stop(); media.removeEventListener("change", stop); };
  }, []);

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
      morphs.current.forEach(animation => animation.cancel());
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
      onKeyDownCapture={() => { keyboard.current = true; root.current!.dataset.instant = "true"; morphs.current.forEach(animation => animation.cancel()); }}
      onPointerDownCapture={() => { keyboard.current = false; root.current!.dataset.instant = String(reducedMotion()); }}>
      <div ref={backdrop} className="paywall-backdrop" onClick={onClose} />
      <div ref={panel} className="paywall-panel">
        <button type="button" ref={grip} className="paywall-grip" onClick={onHeadClick}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          onPointerCancel={() => { drag.current = null; swallowClick.current = true; go(stage.current, "none"); }}
          aria-expanded={expanded} aria-label={expanded ? "Ciutkan manfaat Plus" : "Lihat semua manfaat Plus"}><span /></button>
        <div ref={scroll} className="paywall-scroll">
          <div ref={head} className="paywall-head">
            <span className="paywall-seal"><img src="/plus-seal.png" width="157" height="100" alt="Plus" /></span>
            <h3>Pilih paket Plus</h3>
            <p className="muted">Untuk malam-malam panjang: perkiraan, pengingat, dan grafik. Sinkron &amp; pasangan tetap gratis.</p>
            <ul className="paywall-checklist" aria-hidden={expanded}>
              {["Perkiraan menyusu", "Pengingat", "Grafik tren", "Riwayat > 30 hari", "PDF tanpa batas", "Wishlist & multi bayi"].map((label, i) => <li key={label}><span data-plus-morph={`icon-${i}`}><Check size={11} aria-hidden="true" /></span><strong data-plus-morph={`title-${i}`}>{label}</strong></li>)}
            </ul>
          </div>
          <div className="paywall-benefits" inert={!expanded} aria-hidden={!expanded}>
            {(variant ?? last) !== "overview" && <p className="paywall-context muted">{c.body}</p>}
            <ul className="paywall-features">
              {PLUS_FEATURES.map((feature, i) => {
                const Icon = FEATURE_ICONS[i];
                return <li key={feature.title}>
                  <span className="paywall-feature-icon" data-plus-morph={`icon-${i}`}><Icon size={21} strokeWidth={1.75} aria-hidden="true" /></span>
                  <div><h4 data-plus-morph={`title-${i}`}>{feature.title}</h4><p className="muted">{feature.body}</p></div>
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
        <PlanPicker sheet value={plan} onChange={setPlan} />
        <a className="btn btn-coral lg block paywall-cta" href="#/plus" onClick={onClose}>Lanjut bayar · {plan === "plus_lifetime" ? "Selamanya" : "Bulanan"}</a>
        <p className="paywall-note">Pembayaran lewat Midtrans · Sandbox.<br />Tidak ada uang nyata yang ditagih. Kamu bisa cek dulu sebelum bayar.</p>
        <button type="button" className="paywall-later" onClick={onClose}>Nanti saja</button>
      </div>
    </div>,
    document.body,
  );
}

/** Small coral "Plus" label: paywall title, Insight preview. */
export function PlusPill() {
  return <span className="plus-pill"><Sparkles size={13} strokeWidth={2.5} aria-hidden="true" />Plus</span>;
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
  const arc = useRef<SVGCircleElement>(null);
  const dot = useRef<SVGGElement>(null);
  // First-run entrance: the ring draws from 0 and the knob travels with it. Mount only; later updates are instant.
  useLayoutEffect(() => {
    if (reducedMotion()) return;
    const timing = { duration: 700, delay: 100, easing: EASE_OUT, fill: "backwards" as const };
    arc.current?.animate([{ strokeDashoffset: c }, { strokeDashoffset: c * (1 - v) }], timing);
    dot.current?.animate([{ transform: "rotate(0deg)" }, { transform: `rotate(${v * 360}deg)` }], timing);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
          ref={arc}
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)}
        />
        {knob && v > 0.02 && (
          <g ref={dot} style={{ transformOrigin: `${size / 2}px ${size / 2}px`, transform: `rotate(${v * 360}deg)` }}>
            <circle cx={size / 2 + r} cy={size / 2} r={stroke * 0.9} fill="#E8A0A8" stroke="var(--surface)" strokeWidth={3} />
          </g>
        )}
      </svg>
      <div className="center">{children}</div>
    </div>
  );
}

// Tiny global toast.
let toastMsg: string | null = null;
const toastListeners = new Set<() => void>();
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  toastMsg = msg;
  toastListeners.forEach((l) => l());
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastMsg = null; toastListeners.forEach((l) => l()); }, 2400);
}
export function Toaster() {
  const msg = useSyncExternalStore((l) => { toastListeners.add(l); return () => toastListeners.delete(l); }, () => toastMsg);
  // Stays mounted so the exit can play; visibility is an interruptible transition.
  const [text, setText] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!msg) { setVisible(false); return; }
    setText(msg);
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [msg]);
  return text ? <div className="toast" role="status" data-visible={visible}>{text}</div> : null;
}
