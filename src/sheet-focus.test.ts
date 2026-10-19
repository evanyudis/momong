import assert from "node:assert/strict";
import { test } from "node:test";
import { pickSheetFocus } from "./sheet-focus.ts";

test("a sheet focuses the title, not the close button, unless the caller names a control", () => {
  const heading = { id: "title" };
  const close = { id: "close" };
  const asked: string[] = [];
  const dialog = {
    contains: (node: unknown) => node === heading || node === close,
    querySelector: (selector: string) => {
      asked.push(selector);
      assert.equal(selector, "h3");
      return heading;
    },
  };
  assert.equal(pickSheetFocus(dialog), heading);
  assert.deepEqual(asked, ["h3"]);
  assert.equal(pickSheetFocus(dialog, close), close);
  assert.deepEqual(asked, ["h3"], "an explicit target does not search for the close button");
});
