import assert from "node:assert/strict";
import { test } from "node:test";
import { keyboardInset, sheetKeyboardMaxHeight } from "./sheet-keyboard.ts";

test("keyboard inset sits the sheet on the visual viewport, not an extra keyboard height", () => {
  assert.equal(keyboardInset(667, 667, 0), 0);
  assert.equal(keyboardInset(667, 331, 0), 336);
  // iOS scrolls the visual viewport when the name field focuses. Vaul treats
  // innerHeight - height as the keyboard and lifts the sheet again.
  assert.equal(keyboardInset(667, 331, 196), 140);
  assert.equal(keyboardInset(932, 596, 328), 8);
  assert.equal(keyboardInset(812, 900, 40), 0);
  assert.equal(keyboardInset(Number.NaN, 300, 0), 0);
});

test("sheet stays inside the visible band above the keyboard", () => {
  assert.equal(sheetKeyboardMaxHeight(331), 319);
  assert.equal(sheetKeyboardMaxHeight(596), 584);
  assert.equal(sheetKeyboardMaxHeight(100), 160);
});
