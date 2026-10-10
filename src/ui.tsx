import { PlusBadge } from "./PlusBadge";
export { PlusBadge } from "./PlusBadge";
import { PlusMesh } from "./PlusMesh";
import { PLUS_ENABLED } from "./release";
import { PlanPicker, selectedPlan } from "./billing";
import { Baby, Bell, CalendarDays, ChartNoAxesColumn, CircleCheck, CircleAlert, Info, Check, ChevronLeft, FileText, Gift, History, Sparkles, Timer, Trash2, X } from "lucide-react";
import { type ComponentProps, type ReactNode, type RefObject, createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Toaster as SonnerToaster } from "sonner";
import { toast } from "./toast";
export { toast } from "./toast";
import { Drawer } from "vaul";
import { PLUS_COPY, PLUS_FEATURES, type PlusVariant } from "./content";
import { dayLabel } from "./dates";

/**
 * Native date/time picker that fits its container: full width, value left-aligned, calendar glyph on the right.
 * Every native input prop passes through (value/onChange or defaultValue, min/max, required, aria-*, ref).
 */
export function DateInput({ className, type = "date", ...props }: Omit<ComponentProps<"input">, "type"> & { type?: "date" | "time" | "datetime-local" }) {
  return (
    <span className="date-input">
      <input {...props} type={type} className={className ? `input ${className}` : "input"} />
      <CalendarDays className="date-input-icon" size={20} aria-hidden="true" />
    </span>
  );
}

const SheetContext = createContext(0);

function useSheetFocus(initialFocus?: RefObject<HTMLElement | null>) {
  const previous = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus(event: Event) {
      event.preventDefault();
      previous.current = document.activeElement as HTMLElement;
      const dialog = event.currentTarget as HTMLElement;
      const target = initialFocus?.current ?? (matchMedia("(pointer: coarse)").matches
        ? dialog.querySelector<HTMLElement>("h3")
        : dialog.querySelector<HTMLElement>('button:not(:disabled), [role="button"], input:not(:disabled), a[href]'));
      (target ?? dialog).focus({ preventScroll: true });
    },
    onCloseAutoFocus(event: Event) {
      event.preventDefault();
      const target = previous.current;
      if (target?.isConnected && !target.closest('[data-state="closed"], [inert]')) target.focus({ preventScroll: true });
      else if (document.activeElement === document.body || document.activeElement?.closest('[data-state="closed"]')) document.querySelector<HTMLElement>('[role="dialog"][data-state="open"] h3, main h1, main h2')?.focus({ preventScroll: true });
    },
  };
}

// Vaul 1.1.2 leaves pointercancel dragging; settle at the starting point without a fling.
function useCancelledDrag() {
  const start = useRef({ clientX: 0, clientY: 0 });
  return {
    onPointerDownCapture(event: React.PointerEvent<HTMLDivElement>) {
      start.current = { clientX: event.clientX, clientY: event.clientY };
    },
    onPointerCancel(event: React.PointerEvent<HTMLDivElement>) {
      const drawer = event.currentTarget;
      if ((event.target as Element).closest("[data-vaul-drawer]") !== drawer) return;
      drawer.style.transform = "translate3d(0, var(--snap-point-height, 0px), 0)";
      drawer.dispatchEvent(new PointerEvent("pointerup", {
        bubbles: true, pointerId: event.pointerId, pointerType: event.pointerType, ...start.current,
      }));
    },
  };
}

export function Sheet({ open, onOpenChange, title, children, initialFocus }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode; initialFocus?: RefObject<HTMLElement | null>;
}) {
  const depth = useContext(SheetContext);
  const Root = depth ? Drawer.NestedRoot : Drawer.Root;
  const focus = useSheetFocus(initialFocus);
  const cancelledDrag = useCancelledDrag();
  return <Root open={open} onOpenChange={onOpenChange} handleOnly repositionInputs>
    <SheetContext.Provider value={depth + 1}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-backdrop" style={{ zIndex: `calc(var(--z-sheet) + ${depth * 2})` }} />
        <Drawer.Content className="sheet" style={{ zIndex: `calc(var(--z-sheet) + ${depth * 2 + 1})` }} aria-describedby={undefined} {...cancelledDrag} {...focus}>
          <Drawer.Handle className="sheet-grip" />
          <div className="sheet-heading"><Drawer.Title asChild><h3 tabIndex={-1}>{title}</h3></Drawer.Title><Drawer.Close asChild><button type="button" className="icon-btn" aria-label="Tutup"><X size={20} /></button></Drawer.Close></div>
          <div className="sheet-body">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </SheetContext.Provider>
  </Root>;
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

const FEATURE_ICONS = [Timer, Bell, ChartNoAxesColumn, History, FileText, Gift, Baby];

export function PlusSheet({ variant, onClose }: { variant: PlusVariant | null; onClose: () => void }) {
  const [plan, setPlan] = useState(selectedPlan);
  const [last, setLast] = useState<PlusVariant>("insights");
  useEffect(() => { if (variant) setLast(variant); }, [variant]);
  const c = PLUS_COPY[variant ?? last];
  const root = useRef<HTMLDivElement>(null);
  const layout = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const foot = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [compactHeight, setCompactHeight] = useState(420);
  const [fullHeight, setFullHeight] = useState(window.innerHeight - 16);
  useLayoutEffect(() => { if (variant) setExpanded(false); }, [variant]);
  const focus = useSheetFocus();
  const cancelledDrag = useCancelledDrag();
  const depth = useContext(SheetContext);
  const Root = depth ? Drawer.NestedRoot : Drawer.Root;

  useLayoutEffect(() => {
    if (!variant) return;
    const measure = () => {
      if (!head.current || !foot.current || !root.current) return;
      const inset = parseFloat(getComputedStyle(root.current).getPropertyValue("--sheet-top-inset")) || 16;
      const full = window.innerHeight - inset;
      setFullHeight(full);
      if (!expanded) setCompactHeight(Math.min(full - 1, Math.ceil(54 + head.current.offsetHeight + foot.current.offsetHeight)));
    };
    // Portal content mounts after the root; wait one frame before observing its geometry.
    let observer: ResizeObserver;
    const frame = requestAnimationFrame(() => {
      measure();
      observer = new ResizeObserver(measure);
      if (head.current) observer.observe(head.current);
      if (foot.current) observer.observe(foot.current);
    });
    addEventListener("resize", measure);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); removeEventListener("resize", measure); };
  }, [variant, expanded]);

  const compact = `${compactHeight}px`, full = `${fullHeight}px`;
  const release = () => {
    layout.current?.style.removeProperty("height");
    layout.current?.style.removeProperty("transition");
  };
  return <Root open={!!variant} onOpenChange={(open) => { if (!open) onClose(); }}
    handleOnly repositionInputs snapPoints={[compact, full]} fadeFromIndex={1}
    activeSnapPoint={expanded ? full : compact} setActiveSnapPoint={(point) => {
      setExpanded(point === full);
      if (point !== full && scroll.current) scroll.current.scrollTop = 0;
    }} snapToSequentialPoint
    onDrag={() => {
      moved.current = true;
      if (layout.current && root.current) {
        layout.current.style.transition = "none";
        layout.current.style.height = `${Math.max(0, window.innerHeight - root.current.getBoundingClientRect().top)}px`;
      }
    }} onRelease={release}>
    <SheetContext.Provider value={depth + 1}>
      <Drawer.Portal>
        <Drawer.Overlay className="paywall-backdrop" style={{ zIndex: `calc(var(--z-sheet) + ${depth * 2})` }} />
        <Drawer.Content ref={root} className="paywall" style={{ zIndex: `calc(var(--z-sheet) + ${depth * 2 + 1})` }} data-expanded={expanded} aria-describedby={undefined} {...cancelledDrag} onPointerCancel={(event) => { cancelledDrag.onPointerCancel(event); release(); }} {...focus}>
          <PlusMesh />
          <div ref={layout} className="paywall-layout">
            <Drawer.Handle className="sheet-grip paywall-grip" preventCycle role="button" tabIndex={0} aria-hidden={false}
              aria-expanded={expanded} aria-label={expanded ? "Ciutkan manfaat Plus" : "Lihat semua manfaat Plus"}
              onPointerDownCapture={() => { moved.current = false; }}
              onClick={() => { if (!moved.current) { setExpanded(!expanded); if (scroll.current) scroll.current.scrollTop = 0; } }}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setExpanded(!expanded); if (scroll.current) scroll.current.scrollTop = 0; } }} />
            <div ref={scroll} className="paywall-scroll">
              <div ref={head} className="paywall-head">
                <div className="paywall-title"><Drawer.Title asChild><h3 tabIndex={-1}>Pilih paket Plus</h3></Drawer.Title><PlusBadge /></div>
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
            <div ref={foot} className="paywall-foot">
              {PLUS_ENABLED && <PlanPicker sheet value={plan} onChange={setPlan} />}
              {PLUS_ENABLED ? <a className="btn btn-coral lg block paywall-cta" href="#/plus" onClick={onClose}>Lanjut bayar · {plan === "plus_lifetime" ? "Lifetime" : "Bulanan"}</a> : <button className="btn btn-coral lg block paywall-cta" disabled>Segera hadir</button>}
              <p className="paywall-note">{PLUS_ENABLED ? <>Pembayaran lewat Midtrans · Sandbox.<br />Tidak ada uang nyata yang ditagih. Kamu bisa cek dulu sebelum bayar.</> : <>Fitur Plus sedang disiapkan.<br />Fitur gratis tetap bisa digunakan.</>}</p>
              <button type="button" className="paywall-later" onClick={onClose}>Nanti saja</button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </SheetContext.Provider>
  </Root>;
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
