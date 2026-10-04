import { CalendarDays, ChevronLeft, Sparkles } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { PLUS_COPY, type PlusVariant } from "./content";
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

/** Bottom sheet. Stays mounted through its exit so the slide-down can play. */
export function Sheet({ open, onOpenChange, title, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(t);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);
  if (!mounted) return null;
  return createPortal(
    <>
      <div className="sheet-backdrop" data-open={shown} onClick={() => onOpenChange(false)} />
      <div className="sheet" data-open={shown} role="dialog" aria-modal="true" aria-label={title}>
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
const INSET = 12; // compact card's side gap (px); the card grows to full width as it expands
const EXIT_MS = 200; // matches [data-motion="exit"] in styles.css

/**
 * Plus soft paywall: one surface, three variants. UI only. Nothing here grants Plus, charges, or calls the network.
 * A compact floating sheet that grows into a full page: tap or drag up expands, swipe down collapses, further down
 * dismisses. Transform + opacity only. Drag writes styles directly (no per-frame renders); on release a CSS
 * transition retargets from the live pose, so grabbing it mid-flight and reversing reverses the motion.
 */
export function PlusSheet({ variant, onClose }: { variant: PlusVariant | null; onClose: () => void }) {
  const [last, setLast] = useState<PlusVariant>("insights");
  useEffect(() => { if (variant) setLast(variant); }, [variant]);
  const c = PLUS_COPY[variant ?? last]; // keep the copy through the exit
  const [mounted, setMounted] = useState(!!variant);
  const [expanded, setExpanded] = useState(false);
  const backdrop = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const foot = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage>("closed");
  const drag = useRef<{ y0: number; Y0: number; Y: number; y: number; t: number; v: number; moved: boolean } | null>(null);
  const swallowClick = useRef(false);

  // Y = the panel's translateY. Compact parks it so only head + footer show; expanded is Y = 0.
  function geo() {
    const H = panel.current!.offsetHeight, W = panel.current!.offsetWidth;
    const sc = (W - 2 * INSET) / W;
    const Yc = H - sc * (head.current!.offsetTop + head.current!.offsetHeight + foot.current!.offsetHeight);
    return { H, sc, Yc };
  }
  // One pose drives every layer, so panel, footer and backdrop always move as a unit.
  function place(Y: number, motion: Motion) {
    const { H, sc, Yc } = geo();
    const s = sc + (1 - sc) * Math.min(Math.max(1 - Y / Yc, 0), 1);
    for (const el of [backdrop.current!, panel.current!, foot.current!]) el.dataset.motion = motion;
    panel.current!.style.transform = `translate(-50%, ${Y}px) scale(${s})`;
    foot.current!.style.transform = `translate(-50%, ${Math.max(0, Y - Yc)}px) scale(${s})`;
    backdrop.current!.style.opacity = String(Math.min(Math.max((H - Y) / (H - Yc), 0), 1));
  }
  function go(to: Stage, motion = SETTLE[to]) {
    stage.current = to;
    const { H, Yc } = geo();
    place(to === "expanded" ? 0 : to === "compact" ? Yc : H, motion);
    setExpanded(to === "expanded");
  }

  useLayoutEffect(() => {
    if (!mounted) return;
    panel.current!.style.paddingBottom = `${foot.current!.offsetHeight}px`; // expanded list clears the pinned footer
    place(geo().H, "none");
    panel.current!.getBoundingClientRect(); // commit the off-screen pose so the enter transitions from it
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (variant) {
      if (!mounted) setMounted(true);
      else if (stage.current === "closed") go("compact", "enter");
      return;
    }
    if (!mounted) return;
    go("closed");
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [variant, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mounted) return;
    const onResize = () => go(stage.current, "none");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("resize", onResize);
    addEventListener("keydown", onKey);
    return () => { removeEventListener("resize", onResize); removeEventListener("keydown", onKey); };
  }, [mounted, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || stage.current === "closed") return;
    swallowClick.current = false;
    // Grab the sheet where it is right now, even mid-transition.
    const Y = new DOMMatrix(getComputedStyle(panel.current!).transform).f;
    place(Y, "none");
    head.current!.setPointerCapture(e.pointerId);
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
    setExpanded(d.Y < Yc / 2); // the list staggers in or out as the sheet crosses halfway
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
    else if (v > 0.3) to = from === "expanded" && d.Y < Yc ? "compact" : "closed";
    else to = d.Y < Yc / 2 ? "expanded" : d.Y > Yc + 60 ? "closed" : "compact";
    if (to === "closed") onClose();
    else go(to);
  }
  function onHeadClick() {
    if (swallowClick.current) { swallowClick.current = false; return; }
    go(stage.current === "expanded" ? "compact" : "expanded");
  }

  if (!mounted) return null;
  return createPortal(
    <div className="paywall" role="dialog" aria-modal="true" aria-label={c.title} data-expanded={expanded}>
      <div ref={backdrop} className="paywall-backdrop" onClick={onClose} />
      <div ref={panel} className="paywall-panel">
        <div
          ref={head} className="paywall-head" onClick={onHeadClick}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        >
          <button type="button" className="paywall-grip" aria-expanded={expanded} aria-label={expanded ? "Ciutkan" : "Perluas"} />
          <div className="paywall-title"><PlusPill /><h3>{c.title}</h3></div>
          <p className="muted">{c.body}</p>
          {(variant ?? last) === "pdf" && (
            <div className="chart-preview">
              <div className="card-title" style={{ fontSize: 16 }}>Laporan 7 hari</div>
              <div className="card-sub">Menyusu, pompa, popok · PDF</div>
              <BlurBars />
            </div>
          )}
        </div>
      </div>
      <div ref={foot} className="paywall-foot">
        {/* ponytail: intentional no-op. Keel wires checkout here; no entitlement, no network, no navigation until then. */}
        <button type="button" className="btn btn-coral lg block" onClick={() => {}}>Coba Plus</button>
        <button type="button" className="btn btn-soft block" style={{ marginTop: 10 }} onClick={onClose}>Nanti saja</button>
        <p className="faint" style={{ fontSize: 13, textAlign: "center", marginTop: 14 }}>Catatan, bukan saran medis.</p>
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
