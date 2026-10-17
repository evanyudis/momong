/** Space kept between the visual viewport's top edge and a sheet sitting over the keyboard. */
export const SHEET_KEYBOARD_GAP = 12;

/**
 * Distance from the layout viewport's bottom to the visual viewport's bottom.
 * iOS Safari scrolls the visual viewport (offsetTop) when a field is focused.
 * Counting that scroll as extra keyboard height lifts the sheet a second time
 * and hides the field above the screen.
 */
export function keyboardInset(innerHeight: number, viewportHeight: number, offsetTop = 0) {
  if (!Number.isFinite(innerHeight) || !Number.isFinite(viewportHeight)) return 0;
  const scrolled = Number.isFinite(offsetTop) ? offsetTop : 0;
  return Math.max(0, Math.round(innerHeight - viewportHeight - scrolled));
}

/** Tallest a sheet can be while its top, including the focused field, stays on screen. */
export function sheetKeyboardMaxHeight(viewportHeight: number, gap = SHEET_KEYBOARD_GAP) {
  if (!Number.isFinite(viewportHeight)) return 0;
  return Math.max(160, Math.round(viewportHeight - gap));
}
