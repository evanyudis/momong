import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("S&K page renders both documents with no placeholders left and a way back to Plus", async () => {
  const server = await createServer({ server: { middlewareMode: true }, logLevel: "silent" });
  try {
    const { SyaratKetentuan } = await server.ssrLoadModule("/src/screens/SyaratKetentuan.tsx");
    const html = renderToStaticMarkup(createElement(SyaratKetentuan));
    assert.match(html, /Syarat &amp; Ketentuan Momong Plus/);
    assert.match(html, /Kebijakan Refund Momong Plus/);
    assert.equal((html.match(/TODO: tanggal publikasi/g) ?? []).length, 0);
    assert.equal((html.match(/Berlaku sejak: 3 November 2026/g) ?? []).length, 2);
    assert.ok(!html.includes("TODO: link Kebijakan Privasi"));
    assert.match(html, /href="#\/kebijakan-privasi"/);
    assert.match(html, /Pengadilan Negeri Depok/);
    assert.ok(!html.includes("TODO") && !html.includes("legal-todo"), "no TODO left on S&K");
    assert.match(html, /3 x 24 jam/);
    assert.match(html, /14 hari kerja/);
    assert.ok(!html.includes("[link]") && !html.includes("[domisili]"), "raw markdown placeholders are not left behind");
    assert.match(html, /href="#\/plus"/);
  } finally { await server.close(); }
});

test("privacy page renders with effective date, controller, rights, processors and a public route", async () => {
  const server = await createServer({ server: { middlewareMode: true }, logLevel: "silent" });
  try {
    const { KebijakanPrivasi } = await server.ssrLoadModule("/src/screens/KebijakanPrivasi.tsx");
    const html = renderToStaticMarkup(createElement(KebijakanPrivasi));
    assert.match(html, /Kebijakan Privasi Momong/);
    assert.match(html, /Berlaku sejak: 3 November 2026/);
    assert.match(html, /Aditya Evan Yudistira/);
    assert.match(html, /contact\.evanyudis@gmail\.com/);
    assert.match(html, /UU No\. 27 Tahun 2022/);
    assert.match(html, /bersifat spesifik/);
    for (const name of ["Sumopod", "PostHog", "Resend", "Vercel", "Cloudflare", "Tencent Cloud"]) assert.ok(html.includes(name), name);
    assert.ok(!html.includes("Neon"), "no stale Neon mention");
    assert.ok(!html.includes("TODO") && !html.includes("legal-todo"), "no TODO left on privacy page");
    assert.match(html, /<strong>10 tahun<\/strong>/);
    assert.match(html, /dianonimkan/);
    assert.match(html, /<strong>30 hari<\/strong>/);
    assert.match(html, /3 x 24 jam/);
    assert.match(html, /href="https:\/\/sumopod\.com\/privacy-policy"/);
    assert.match(html, /href="#\/syarat-ketentuan"/);
  } finally { await server.close(); }
  const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
  assert.match(app, /"\/syarat-ketentuan", "\/kebijakan-privasi"\]\.includes\(path\)/);
  assert.match(app, /path === "\/kebijakan-privasi"\) screen = <KebijakanPrivasi \/>/);
});

test("monthly consent copy is exact and links to S&K from monthly and lifetime checkout", () => {
  const src = readFileSync(new URL("./screens/Plus.tsx", import.meta.url), "utf8");
  assert.ok(src.includes('Saya paham Plus Bulanan Rp39.000 tidak diperpanjang otomatis, dan saya setuju dengan <a className="inline-link" href={TERMS_HREF}>Syarat & Ketentuan</a>.'));
  assert.ok(!src.includes("Saya setuju perpanjangan otomatis"));
  assert.match(src, /Hentikan perpanjangan/);
  assert.ok(!/[Bb]atalkan perpanjangan/.test(src), "button copy unified to Hentikan perpanjangan");
  assert.match(src, /TERMS_HREF = "#\/syarat-ketentuan"/);
  assert.equal((src.match(/href=\{TERMS_HREF\}/g) ?? []).length, 2, "monthly consent and lifetime checkout both link S&K");
});
