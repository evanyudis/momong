/**
 * Vaul sets `touch-action: none` on the drawer. iOS then drops the click that should
 * follow the first tap on a button or a segmented label, so the control only responds
 * the second time. Pointerup still lands on that control. If no click arrived, fire one.
 * A late real click for that same press is ignored.
 */

const MOVE_PX = 12;
const LATE_CLICK_MS = 500;

export function pressElement(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null;
  const control = node.closest("button, [role='button'], a[href], label");
  if (!(control instanceof HTMLElement)) return null;
  if (control.closest("[data-vaul-handle]")) return null;
  if (control.matches("label")) {
    const field = control.querySelector("input, textarea, select");
    if (field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) return null;
    if (field instanceof HTMLInputElement && field.type !== "radio" && field.type !== "checkbox") return null;
    if (field instanceof HTMLInputElement && field.disabled) return null;
  }
  if (control.matches(":disabled") || control.getAttribute("aria-disabled") === "true") return null;
  return control;
}

export function pressHeld(input: {
  armed: boolean;
  sameId: boolean;
  sameControl: boolean;
  disabled: boolean;
  distance: number;
}) {
  return input.armed && input.sameId && input.sameControl && !input.disabled && input.distance <= MOVE_PX;
}

export function ignoreLateClick(input: { trusted: boolean; sameControl: boolean; now: number; until: number }) {
  return input.trusted && input.sameControl && input.now < input.until;
}

type Arm = { id: number; x: number; y: number; control: HTMLElement };

export function installPress(doc: Document = document) {
  let arm: Arm | null = null;
  let suppress: { control: HTMLElement; until: number } | null = null;
  const waiting = new WeakMap<HTMLElement, number>();
  let token = 0;

  const onDown = (event: PointerEvent) => {
    if (event.button !== 0) { arm = null; return; }
    const control = pressElement(event.target);
    arm = control ? { id: event.pointerId, x: event.clientX, y: event.clientY, control } : null;
  };
  const onUp = (event: PointerEvent) => {
    const current = arm;
    arm = null;
    if (!current || event.pointerId !== current.id) return;
    const control = pressElement(event.target);
    const disabled = !control || control.matches(":disabled") || control.getAttribute("aria-disabled") === "true";
    if (!pressHeld({
      armed: true,
      sameId: true,
      sameControl: control === current.control,
      disabled,
      distance: Math.hypot(event.clientX - current.x, event.clientY - current.y),
    }) || !control) return;
    const mark = ++token;
    waiting.set(control, mark);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (waiting.get(control) !== mark || !control.isConnected) return;
        waiting.delete(control);
        suppress = { control, until: performance.now() + LATE_CLICK_MS };
        control.click();
      });
    });
  };
  const onClick = (event: MouseEvent) => {
    const control = pressElement(event.target);
    if (control && waiting.has(control)) waiting.delete(control);
    if (control && suppress && ignoreLateClick({
      trusted: event.isTrusted,
      sameControl: control === suppress.control,
      now: performance.now(),
      until: suppress.until,
    })) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const onCancel = () => { arm = null; };
  doc.addEventListener("pointerdown", onDown, true);
  doc.addEventListener("pointerup", onUp, true);
  doc.addEventListener("pointercancel", onCancel, true);
  doc.addEventListener("click", onClick, true);
  return () => {
    doc.removeEventListener("pointerdown", onDown, true);
    doc.removeEventListener("pointerup", onUp, true);
    doc.removeEventListener("pointercancel", onCancel, true);
    doc.removeEventListener("click", onClick, true);
  };
}
