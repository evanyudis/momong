import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ErrorBoundary } from "./ErrorBoundary.tsx";

test("render failures show recovery without clearing local records", () => {
  const boundary = new ErrorBoundary({ children: "Normal screen" });
  assert.equal(boundary.render(), "Normal screen");
  boundary.state = ErrorBoundary.getDerivedStateFromError();
  const markup = renderToStaticMarkup(boundary.render());
  assert.match(markup, /role="alert"/);
  assert.match(markup, /Muat ulang/);
  assert.match(markup, /Catatan di perangkat ini tetap tersimpan/);
  let reloads = 0;
  Object.assign(globalThis, { location: { reload() { reloads++; } } });
  const recovery = boundary.render() as any;
  recovery.props.children.props.children[2].props.onClick();
  assert.equal(reloads, 1);
});
