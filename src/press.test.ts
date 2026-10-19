import assert from "node:assert/strict";
import { test } from "node:test";
import { ignoreLateClick, pressHeld } from "./press.ts";

test("a held tap activates, a drag or a second click does not", () => {
  assert.equal(pressHeld({ armed: true, sameId: true, sameControl: true, disabled: false, distance: 4 }), true);
  assert.equal(pressHeld({ armed: true, sameId: true, sameControl: true, disabled: false, distance: 40 }), false, "scrolling the sheet is not a tap");
  assert.equal(pressHeld({ armed: true, sameId: true, sameControl: false, disabled: false, distance: 0 }), false);
  assert.equal(pressHeld({ armed: false, sameId: true, sameControl: true, disabled: false, distance: 0 }), false);
  assert.equal(pressHeld({ armed: true, sameId: true, sameControl: true, disabled: true, distance: 0 }), false);
  assert.equal(ignoreLateClick({ trusted: true, sameControl: true, now: 100, until: 200 }), true, "the real click after a stand-in tap is ignored");
  assert.equal(ignoreLateClick({ trusted: false, sameControl: true, now: 100, until: 200 }), false, "the stand-in click still runs the control");
  assert.equal(ignoreLateClick({ trusted: true, sameControl: true, now: 200, until: 200 }), false);
});
