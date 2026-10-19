type SheetFocusRoot = ParentNode & { contains: (node: Node | null) => boolean };

/**
 * Focus the caller's target, otherwise the sheet title.
 * The close control is the first button. Focusing it makes the next tap only move focus there.
 */
export function pickSheetFocus(dialog: SheetFocusRoot, explicit?: Node | null) {
  if (explicit && dialog.contains(explicit)) return explicit;
  return dialog.querySelector("h3") ?? dialog;
}
