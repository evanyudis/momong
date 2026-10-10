import assert from 'node:assert/strict';

// Install Playwright locally, or set PLAYWRIGHT_MODULE to an existing index.mjs.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:5181';
const preview = process.argv.includes('--preview');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
const settle = () => page.waitForTimeout(600);
const dialog = name => page.getByRole('dialog', { name, exact: true });
const closed = async () => { await settle(); assert.equal(await page.getByRole('dialog').count(), 0); };
async function geometry(selector, fn) { return page.locator(selector).evaluate(fn); }
async function drag(selector, dy) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + dy, { steps: 16 });
  if (selector === '.paywall-grip' && (dy < 0 || await page.locator('.paywall').getAttribute('data-expanded') === 'true')) await plusLayout();
  await page.mouse.up();
  await settle();
}
async function touchSwipe(selector, dy) {
  const box = await page.locator(selector).boundingBox();
  const x = box.x + box.width / 2, y = dy < 0 ? box.y + box.height - 40 : box.y + 22;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let step = 1; step <= 12; step++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + dy * step / 12 }] });
    await page.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach(); await settle();
}
async function noOverflow() {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
}
async function plusLayout() {
  assert.ok(await geometry('.paywall-foot', el => el.getBoundingClientRect().bottom <= innerHeight + 1), 'footer stays visible');
  assert.ok(await geometry('.paywall-scroll', el => el.clientHeight > 0 && el.getBoundingClientRect().bottom <= document.querySelector('.paywall-foot').getBoundingClientRect().top + 1), 'content clears footer');
  await noOverflow();
}
try {
  if (preview) {
    await page.addInitScript(() => {
      localStorage.setItem('bb_prefs_v1', JSON.stringify({ guest: true, name: 'Sheet test', theme: 'light' }));
      localStorage.setItem('bb_db_v1', JSON.stringify({ settings: { main: { id: 'main', updatedAt: Date.now(), birthMode: 'postpartum', babyName: 'Si kecil', babyBirth: '2026-10-01' } } }));
    });
    await page.goto(`${url}/#/profil`);
    await page.getByRole('button', { name: 'Edit profil', exact: true }).click();
    await settle();
    assert.equal(await page.evaluate(() => document.activeElement.tagName), 'H3', 'touch does not autofocus an input');
    await dialog('Edit profil').getByLabel('Nama si kecil').fill('Preview check');
    await dialog('Edit profil').getByRole('button', { name: 'Selesai' }).click();
    await closed();
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Edit profil');
    await page.getByRole('button', { name: 'Pulihkan cadangan', exact: true }).click();
    await settle();
    assert.equal(await dialog('Pulihkan cadangan').count(), 1);
    await page.keyboard.press('Escape'); await closed();
    await page.getByRole('button', { name: 'Tambahkan ke layar utama', exact: true }).click();
    await settle();
    assert.equal(await page.getByRole('dialog').count(), 1);
    await page.getByRole('button', { name: 'Tutup', exact: true }).click(); await closed();
    await page.getByRole('button', { name: 'Hapus semua data di perangkat', exact: true }).click();
    await settle();
    await page.getByRole('dialog').getByRole('button', { name: 'Batal', exact: true }).click(); await closed();
    for (const [width, height] of [[320, 568], [390, 844], [667, 375]]) {
      await page.setViewportSize({ width, height });
      await page.getByRole('button', { name: 'Edit profil', exact: true }).click(); await settle();
      await noOverflow();
      assert.ok(await geometry('.sheet', el => el.getBoundingClientRect().bottom <= innerHeight + 1));
      await page.getByRole('button', { name: 'Tutup', exact: true }).click(); await closed();
    }
  } else {
    await page.goto(`${url}/scripts/sheets-check.html`);
    const openForm = async () => { await page.getByRole('button', { name: 'Open form', exact: true }).click(); await settle(); };
    const openPlus = async () => { await page.getByRole('button', { name: 'Open Plus', exact: true }).click(); await settle(); };
    await openForm();
    assert.equal(await page.evaluate(() => document.activeElement.tagName), 'H3');
    const position = await geometry('.sheet', el => el.getBoundingClientRect().top);
    await touchSwipe('.sheet-body', -220);
    assert.ok(await geometry('.sheet-body', el => el.scrollTop > 0), 'touch scroll works inside body');
    assert.equal(await geometry('.sheet', el => el.getBoundingClientRect().top), position);
    await page.locator('.sheet-body').evaluate(el => { el.scrollTop = el.scrollHeight; });
    assert.ok(await geometry('.sheet-body', el => el.scrollTop > 0));
    assert.equal(await geometry('.sheet', el => el.getBoundingClientRect().top), position, 'scroll does not move drawer');
    const savedScroll = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 300); await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => scrollY), savedScroll, 'background stays locked');
    await dialog('Long form').getByRole('button', { name: 'Hapus fixture' }).click(); await settle();
    assert.equal(await page.locator('[role=dialog]').count(), 2);
    assert.equal(await page.getByRole('dialog').count(), 1, 'parent is hidden from accessibility while nested');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Batal', 'explicit focus wins');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Tutup');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Ya, hapus', 'nested focus wraps');
    await page.keyboard.press('Escape'); await settle();
    assert.equal(await page.getByRole('dialog').count(), 1, 'Escape closes only child');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Delete fixture');
    await dialog('Long form').getByRole('button', { name: 'Hapus fixture' }).click(); await settle();
    await dialog('Hapus catatan?').getByRole('button', { name: 'Ya, hapus' }).click(); await closed();
    assert.equal(await page.evaluate(() => document.body.style.pointerEvents), '', 'parent-first close releases locks');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Open form', 'parent-first close restores outer trigger');
    await openForm();
    await drag('.sheet-grip', 350); await closed();
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Open form');
    await openForm(); await page.mouse.click(5, 5); await closed();
    await openForm(); await page.keyboard.press('Escape'); await closed();
    await openPlus();
    assert.equal(await page.locator('.paywall').getAttribute('data-expanded'), 'false');
    assert.equal(await page.locator('.paywall-cta').isDisabled(), true, 'Plus stays coming soon');
    await plusLayout();
    await page.getByRole('button', { name: 'Lihat semua manfaat Plus' }).click(); await settle();
    assert.equal(await page.locator('.paywall').getAttribute('data-expanded'), 'true');
    await page.locator('.paywall-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
    assert.ok(await geometry('.paywall-scroll', el => el.scrollTop > 0));
    await plusLayout();
    await drag('.paywall-grip', 220);
    assert.equal(await page.locator('.paywall').getAttribute('data-expanded'), 'false', 'down collapses first');
    assert.equal(await geometry('.paywall-scroll', el => el.scrollTop), 0);
    await plusLayout();
    await drag('.paywall-grip', -220);
    assert.equal(await page.locator('.paywall').getAttribute('data-expanded'), 'true', 'up expands');
    const grip = await page.locator('.paywall-grip').boundingBox();
    await page.mouse.move(grip.x + 32, grip.y + 22); await page.mouse.down();
    await page.mouse.move(grip.x + 32, grip.y + 102, { steps: 6 });
    await page.locator('.paywall-grip').dispatchEvent('pointercancel', { pointerId: 1, clientX: grip.x + 32, clientY: grip.y + 102 });
    await page.mouse.up(); await settle();
    assert.equal(await page.locator('.vaul-dragging').count(), 0, 'cancel releases drag');
    assert.equal(await page.locator('.paywall').getAttribute('data-expanded'), 'true', 'small cancelled drag settles expanded');
    await plusLayout();
    await page.getByRole('button', { name: 'Ciutkan manfaat Plus' }).click(); await settle();
    await drag('.paywall-grip', 240); await closed();
    await openPlus();
    for (const [width, height] of [[320, 568], [390, 844], [667, 375]]) {
      await page.setViewportSize({ width, height }); await settle(); await plusLayout();
      await page.locator('.paywall-grip').click(); await settle(); await plusLayout();
      await page.locator('.paywall-grip').click(); await settle(); await plusLayout();
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('.paywall-grip').click(); await settle();
    assert.equal(await geometry('.paywall', el => getComputedStyle(el).transitionDuration), '0s');
    await page.keyboard.press('Escape'); await closed();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Open timer' }).click(); await settle();
    await page.getByText('Kiri', { exact: true }).click();
    await page.getByRole('button', { name: 'Mulai timer', exact: true }).click();
    const draft = await page.evaluate(() => localStorage.getItem('bb_breast_timer_v1'));
    assert.ok(draft);
    await page.getByRole('button', { name: 'Tutup', exact: true }).click(); await closed();
    await page.reload();
    await page.getByRole('button', { name: 'Open timer' }).click(); await settle();
    assert.equal(await page.getByRole('button', { name: 'Hentikan timer' }).count(), 1);
    assert.equal(await page.evaluate(() => localStorage.getItem('bb_breast_timer_v1')), draft);
    await page.getByRole('button', { name: 'Tutup', exact: true }).click(); await closed();
    for (const [button, title] of [['Open restore', 'Pulihkan cadangan'], ['Open install', 'Tambahkan ke layar utama']]) {
      await page.getByRole('button', { name: button, exact: true }).click(); await settle();
      assert.equal(await dialog(title).count(), 1);
      await page.keyboard.press('Escape'); await closed();
    }
    const desktop = await browser.newContext({ viewport: { width: 1000, height: 800 } });
    const desktopPage = await desktop.newPage();
    await desktopPage.goto(`${url}/scripts/sheets-check.html`);
    await desktopPage.getByRole('button', { name: 'Open form', exact: true }).click();
    await desktopPage.waitForTimeout(600);
    assert.equal(await desktopPage.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Tutup');
    await desktopPage.keyboard.press('Shift+Tab');
    assert.equal(await desktopPage.evaluate(() => document.activeElement.textContent), 'Save fixture');
    await desktopPage.keyboard.press('Escape'); await desktopPage.waitForTimeout(600);
    await desktopPage.getByRole('button', { name: 'Open Plus', exact: true }).click(); await desktopPage.waitForTimeout(600);
    await desktopPage.locator('.paywall-grip').focus(); await desktopPage.keyboard.press('Enter'); await desktopPage.waitForTimeout(600);
    assert.equal(await desktopPage.locator('.paywall').getAttribute('data-expanded'), 'true', 'keyboard expands Plus');
    await desktopPage.keyboard.press('Space'); await desktopPage.waitForTimeout(600);
    assert.equal(await desktopPage.locator('.paywall').getAttribute('data-expanded'), 'false', 'keyboard collapses Plus');
    await desktop.close();
  }
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  console.log(`PASS: ${preview ? 'preview app sheets' : 'Vaul gestures, scroll, nested focus, layouts, timer persistence and release flags'}`);
} finally {
  await browser.close();
}
