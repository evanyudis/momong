import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const contrast = (a: number, b: number) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
function luminance(hex: string) {
  const rgb = hex.match(/[\da-f]{2}/gi)!.map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}
test("text and flat glyph colors keep AA contrast in both themes", () => {
  const themes = [["light", css.split("@media only screen")[0]], ["dark", css.split(':root[data-theme="dark"]')[1].split("}")[0]]];
  for (const [name, body] of themes) {
    const value = (token: string) => Number(body.split("--" + token + ": oklch(")[1].split(" ")[0]);
    assert.ok(body.includes("--ink-faint: var(--ink-muted)"));
    assert.ok(contrast(value("ink-muted") ** 3, value("bg") ** 3) >= 4.5, name + " caption contrast");
    assert.ok(contrast(value("ink-muted") ** 3, value("surface") ** 3) >= 4.5, name + " surface caption contrast");
  }
  const success = css.match(/--success-ink: (#[\da-f]{6})/i)![1];
  assert.ok(contrast(luminance(success), luminance("ffffff")) >= 4.5, "success label contrast");
  const glyphs = [...css.matchAll(/\.glyph\.(\w+) \{ background: (#[\da-f]{6}); color: (#[\da-f]{6}); \}/gi)];
  assert.equal(glyphs.length, 5);
  for (const [, name, bg, fg] of glyphs) {
    assert.ok(contrast(luminance(bg), luminance(fg)) >= 4.5, name + " glyph contrast");
  }
});
