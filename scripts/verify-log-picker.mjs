import assert from 'node:assert/strict';

// Use an installed Playwright, or set PLAYWRIGHT_MODULE to its index.mjs. Requires Chrome and Playwright WebKit.
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:5181';
await Promise.all([['Chrome', chromium], ['WebKit', webkit]].map(async ([name, engine]) => {
  const browser = await engine.launch({ headless: true, ...(name === 'Chrome' ? { channel: 'chrome' } : {}) });
  try {
    for (const width of [320, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => {
        // WebKit can defer React Aria popover resize notifications to the next frame.
        if (error.message !== 'ResizeObserver loop completed with undelivered notifications.') errors.push(error.message);
      });
      await page.addInitScript(() => {
        if (localStorage.getItem('bb_prefs_v1')) return;
        localStorage.setItem('bb_prefs_v1', JSON.stringify({ guest: true, name: 'Picker test', theme: 'light' }));
        localStorage.setItem('bb_db_v1', JSON.stringify({ settings: { main: { id: 'main', updatedAt: Date.now(), birthMode: 'postpartum', babyName: 'Si kecil', babyBirth: '2026-10-01' } } }));
      });
      await page.goto(url);
      for (const [kind, label] of [['bottle', 'Minum susu'], ['breast', 'Menyusu langsung'], ['pump', 'Pumping'], ['diaper', 'Ganti popok']]) {
        await page.getByRole('button', { name: 'Tambah catatan', exact: true }).click();
        await page.getByRole('menuitem', { name: label, exact: true }).press('Enter');
        await page.waitForTimeout(600);
        const picker = page.locator('input[type="datetime-local"]');
        await picker.scrollIntoViewIfNeeded();
        const bounds = await picker.evaluate(el => {
          const body = document.querySelector('.sheet-body'), field = el.closest('.field');
          const r = el.getBoundingClientRect(), b = body.getBoundingClientRect(), f = field.getBoundingClientRect();
          body.scrollLeft = 200;
          return { fits: r.left >= b.left - 1 && r.right <= b.right + 1 && f.right <= b.right + 1,
            client: body.clientWidth, scroll: body.scrollWidth, left: body.scrollLeft };
        });
        assert.ok(bounds.fits, `${name} ${width}px ${kind}: picker and field fit the sheet`);
        assert.ok(bounds.scroll <= bounds.client + 1, `${name} ${width}px ${kind}: no overflowing sheet content`);
        assert.equal(bounds.left, 0, `${name} ${width}px ${kind}: sheet cannot pan horizontally`);
        const at = await page.evaluate(() => {
          const d = new Date(Date.now() - 600000), pad = n => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        });
        await picker.fill(at);
        assert.equal(await picker.inputValue(), at, 'date/time remains editable');
        if (kind === 'bottle') {
          await page.getByLabel('Jumlah ditawarkan (ml)', { exact: true }).fill('60');
          await page.getByLabel('Sisa susu (ml)', { exact: true }).fill('20');
        } else if (kind === 'breast' || kind === 'pump') {
          await page.getByText('Kiri', { exact: true }).click();
          if (kind === 'breast') await page.getByLabel('Durasi (menit:detik)', { exact: true }).fill('05:30');
          else await page.getByLabel('Hasil pumping (ml, opsional)', { exact: true }).fill('60');
        } else await page.getByText('Pipis', { exact: true }).click();
        await page.getByRole('button', { name: 'Simpan catatan', exact: true }).click();
        await page.waitForTimeout(600);
        assert.equal(await page.getByRole('dialog').count(), 0);
        assert.ok(await page.evaluate(({ kind, at }) => Object.values(JSON.parse(localStorage.getItem('bb_db_v1'))[kind]).some(record => record.at === new Date(at).getTime()), { kind, at }), 'saved timestamp keeps its local date/time');
      }
      await page.reload();
      assert.ok(await page.evaluate(() => ['bottle', 'breast', 'pump', 'diaper'].every(kind => Object.keys(JSON.parse(localStorage.getItem('bb_db_v1'))[kind]).length === 1)), 'all four records survive reload');
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS: ${name} ${width}px — all log pickers fit, no horizontal sheet scroll, timestamps save and survive reload`);
    }
  } finally { await browser.close(); }
}));
