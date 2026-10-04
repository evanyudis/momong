import { CalendarDays, ChevronLeft } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
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
