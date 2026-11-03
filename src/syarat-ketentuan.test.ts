import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("S&K page renders both documents with placeholders visible as TODO and a way back to Plus", async () => {
  const server = await createServer({ server: { middlewareMode: true }, logLevel: "silent" });
  try {
    const { SyaratKetentuan } = await server.ssrLoadModule("/src/screens/SyaratKetentuan.tsx");
    const html = renderToStaticMarkup(createElement(SyaratKetentuan));
    assert.match(html, /Syarat &amp; Ketentuan Momong Plus/);
    assert.match(html, /Kebijakan Refund Momong Plus/);
    assert.equal((html.match(/TODO: tanggal publikasi/g) ?? []).length, 2);
    assert.match(html, /TODO: link Kebijakan Privasi/);
    assert.match(html, /TODO: domisili pengadilan/);
    assert.ok(!html.includes("[link]") && !html.includes("[domisili]"), "raw markdown placeholders are not left behind");
    assert.match(html, /href="#\/plus"/);
  } finally { await server.close(); }
});

test("monthly consent copy is exact, links to S&K, and sends consent version monthly-v2", () => {
  const src = readFileSync(new URL("./screens/Plus.tsx", import.meta.url), "utf8");
  assert.ok(src.includes('Saya paham Plus Bulanan Rp39.000 tidak diperpanjang otomatis, dan saya setuju dengan <a className="inline-link" href={TERMS_HREF}>Syarat & Ketentuan</a>.'));
  assert.ok(!src.includes("Saya setuju perpanjangan otomatis"));
  assert.match(src, /MONTHLY_CONSENT_VERSION = "monthly-v2"/);
  assert.match(src, /consentVersion: MONTHLY_CONSENT_VERSION/);
  assert.match(src, /TERMS_HREF = "#\/syarat-ketentuan"/);
  assert.equal((src.match(/href=\{TERMS_HREF\}/g) ?? []).length, 2, "monthly consent and lifetime checkout both link S&K");
});
