import { execFileSync } from "node:child_process";

// Requires agent-browser on PATH (or AGENT_BROWSER_BIN); run against a Vite dev server.
const url = process.argv[2] ?? "http://127.0.0.1:5173";
const session = `plus-check-${process.pid}`;
const browser = (...args) => execFileSync(process.env.AGENT_BROWSER_BIN ?? "agent-browser", ["--session", session, ...args], { encoding: "utf8", timeout: 30_000 }).trim();
const evaluate = (code) => browser("eval", code);
const check = (code) => evaluate(`(async () => {
  await new Promise(resolve => setTimeout(resolve, 320));
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const sheet = document.querySelector('.paywall');
  const footer = document.querySelector('.paywall-foot');
  const scroll = document.querySelector('.paywall-scroll');
  ${code}
  return 'PASS';
})()`);
const click = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click(); true`);
const open = () => evaluate(`(() => { const b = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Coba Plus'); b.focus(); b.click(); return true; })()`);
const drag = (dy) => {
  const { x, y } = JSON.parse(evaluate(`(() => { const r = document.querySelector('.paywall-grip').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`));
  browser("mouse", "move", String(x), String(y));
  browser("mouse", "down");
  browser("mouse", "move", String(x), String(y + dy));
  browser("mouse", "up");
};

try {
  browser("open", url);
  evaluate(`(async () => {
    const store = await import('/src/store.ts');
    store.setPrefs({guest:true,name:'Bunda',theme:'light'});
    store.saveSettings({birthMode:'postpartum',babyName:'Si kecil',babyBirth:'2026-10-01'});
    sessionStorage.removeItem('bb_plus_plan');
    location.hash = '/profil';
    return true;
  })()`);
  browser("reload");
  browser("set", "viewport", "390", "844");
  open();
  check(`assert(sheet.dataset.expanded === 'false', 'starts compact');
    window.plusCompactHeight = footer.getBoundingClientRect().height;
    assert(sheet.querySelectorAll('.paywall-checklist li').length === 6, 'six checklist items');
    assert(sheet.querySelector('.paywall-seal img').naturalWidth > 0, 'seal loads');
    assert(footer.querySelector('input:checked').value === 'plus_lifetime', 'default lifetime');
    assert(footer.querySelector('.plus-plan-tag').textContent === 'Paling hemat', 'savings badge');
    assert(scroll.getBoundingClientRect().bottom <= footer.getBoundingClientRect().top + 1, 'footer clears content');
    assert(sheet.querySelector('.paywall-benefits').inert, 'hidden details inert');`);
  click('.paywall-grip');
  check(`assert(sheet.dataset.expanded === 'true', 'tap expands');
    assert(getComputedStyle(sheet.querySelector('.paywall-checklist')).display === 'none', 'checklist replaced by complete USPs');
    assert(footer.getBoundingClientRect().height < window.plusCompactHeight - 60, 'expanded packages free vertical space');
    const plans = footer.querySelectorAll('.plus-plan');
    assert(plans[1].getBoundingClientRect().top >= plans[0].getBoundingClientRect().bottom, 'expanded plans stay stacked');
    assert(plans[0].getBoundingClientRect().height >= 44, 'expanded plan remains a touch target');
    assert(getComputedStyle(footer.querySelector('.plus-plan-tag')).display === 'none', 'expanded savings badge hidden');
    assert([...footer.querySelectorAll('.plus-plan-price small')].every(el => getComputedStyle(el).display === 'none'), 'expanded billing units hidden');
    assert(scroll.getBoundingClientRect().bottom <= footer.getBoundingClientRect().top + 1, 'expanded content clears smaller footer');
    assert(sheet.querySelectorAll('.paywall-features li').length === 7, 'seven feature explanations');
    assert(scroll.scrollHeight > scroll.clientHeight, 'details scroll');
    scroll.scrollTop = scroll.scrollHeight;
    assert(scroll.scrollTop > 0, 'scroll moves');
    assert(footer.getBoundingClientRect().bottom <= innerHeight + 1, 'footer remains pinned');`);
  drag(180);
  check(`assert(sheet.dataset.expanded === 'false', 'drag down collapses'); assert(scroll.scrollTop === 0, 'collapse resets scroll');
    assert(getComputedStyle(sheet.querySelector('.paywall-checklist')).display === 'grid', 'collapse restores checklist');
    assert(getComputedStyle(footer.querySelector('.plus-plan-tag')).display !== 'none', 'collapse restores savings badge');
    assert([...footer.querySelectorAll('.plus-plan-price small')].every(el => getComputedStyle(el).display !== 'none'), 'collapse restores billing units');
    assert(Math.abs(footer.getBoundingClientRect().height - window.plusCompactHeight) < 1, 'collapse restores full plan cards');`);
  evaluate(`(async () => {
    const sheet = document.querySelector('.paywall'), grip = sheet.querySelector('.paywall-grip');
    const bottom = sheet.querySelector('.paywall-cta').getBoundingClientRect().bottom;
    const toggle = async () => {
      sheet.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}));
      grip.dispatchEvent(new MouseEvent('click', {bubbles:true,detail:1}));
      await new Promise(requestAnimationFrame);
    };
    await toggle();
    if (sheet.dataset.expanded !== 'true') throw new Error('Details must switch at the start of expansion');
    for (const card of sheet.querySelectorAll('.plus-plan')) {
      const motion = card.getAnimations()[0];
      if (!motion || motion.effect.getKeyframes().at(-1).transform !== 'none') throw new Error('Package cards must settle from their previous visual position');
      if (motion.effect.getTiming().duration > 300) throw new Error('Package transition must stay under 300ms');
    }
    if (sheet.querySelector('.paywall-benefits').getAnimations().length) throw new Error('Details must not run a second animation during the slide');
    if (getComputedStyle(sheet.querySelector('.paywall-backdrop')).backdropFilter !== 'none') throw new Error('Backdrop must not blur the moving surface');
    if (Math.abs(sheet.querySelector('.paywall-cta').getBoundingClientRect().bottom - bottom) > 1) throw new Error('CTA must stay pinned during expansion');
    await toggle();
    if (sheet.dataset.expanded !== 'false') throw new Error('Reversal must immediately restore compact content');
    return true;
  })()`);
  check(`assert(sheet.dataset.expanded === 'false', 'interrupted expansion returns to compact');`);
  drag(-180);
  check(`assert(sheet.dataset.expanded === 'true', 'drag up expands');`);
  const { x, y } = JSON.parse(evaluate(`(() => { const r = document.querySelector('.paywall-grip').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`));
  browser('mouse', 'move', String(x), String(y));
  browser('mouse', 'down');
  browser('mouse', 'move', String(x), String(y + 80));
  evaluate(`document.querySelector('.paywall-grip').dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:1})); true`);
  browser('mouse', 'up');
  check(`assert(sheet.dataset.expanded === 'true', 'cancel restores stage');`);
  click('.paywall-grip');
  drag(100);
  check(`assert(!sheet, 'drag further dismisses');`);
  open();
  click('.paywall input[value="monthly"]');
  check(`assert(sessionStorage.getItem('bb_plus_plan') === 'monthly', 'plan persists');
    assert(sheet.querySelector('.paywall-cta').textContent.includes('Bulanan'), 'CTA follows plan');`);
  browser('set', 'viewport', '320', '568');
  check(`assert(footer.getBoundingClientRect().bottom <= innerHeight + 1, 'small screen footer visible');
    assert(scroll.getBoundingClientRect().bottom <= footer.getBoundingClientRect().top + 1, 'small screen content clears footer');
    assert(scroll.clientHeight > 0, 'small screen content accessible');
    assert(document.documentElement.scrollWidth <= innerWidth, 'no horizontal overflow');`);
  evaluate(`document.documentElement.dataset.theme = 'dark'; true`);
  check(`assert(getComputedStyle(sheet).getPropertyValue('--paywall-ink').trim() === getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(), 'dark theme tokens');`);
  browser('set', 'media', 'dark', 'reduced-motion');
  click('.paywall-grip');
  check(`assert(getComputedStyle(sheet.querySelector('.paywall-panel')).transitionDuration === '0s', 'reduced motion instant');`);
  browser('press', 'Escape');
  check(`assert(!sheet, 'Escape closes'); assert(document.activeElement.textContent === 'Coba Plus', 'focus restored');`);
  open();
  browser('press', 'Shift+Tab');
  check(`assert(document.activeElement.className === 'paywall-later', 'focus wraps inside dialog');`);
  click('.paywall-cta');
  check(`assert(location.hash === '#/plus', 'checkout route'); assert(sessionStorage.getItem('bb_plus_plan') === 'monthly', 'checkout keeps plan');`);
  if (browser('errors')) throw new Error('Browser reported an uncaught error');
  console.log('PASS: Plus sheet layout, gestures, scrolling, plans, keyboard, themes and reduced motion');
} finally {
  browser('close');
}
