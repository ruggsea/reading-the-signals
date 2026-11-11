/* Renders every slide and the main interactions to qa/*.png and prints console errors.
   Run: python3 -m http.server 8765 &   then   node build/qa_shots.cjs <path to playwright module> */
const { chromium } = require(process.argv[2] || 'playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  const U = 'http://127.0.0.1:8765/index.html';
  const shot = async n => { await p.waitForTimeout(1500); await p.screenshot({ path: `qa/${n}.png` }); };
  await p.goto(U); await shot('0-title');
  await p.goto(U + '#/1'); await shot('1-share');
  await p.click('#s1-chips [data-v=gap]'); await shot('1-gap');
  await p.click('#s1-chips [data-v=old]'); await shot('1-old');
  await p.keyboard.press('ArrowRight'); await shot('2-stock-cs');
  await p.click('#s2-view [data-v=all]'); await shot('2-stock-all');
  const bb = await p.locator('#s2-plot').boundingBox();
  await p.mouse.move(bb.x + bb.width * .45, bb.y + bb.height * .2); await p.mouse.move(bb.x + bb.width * .45, bb.y + bb.height * .22); await shot('2-stock-all-hover');
  await p.click('#s2-measure [data-v=entry]'); await shot('2-entry-all');
  await p.click('#s2-view [data-v=cs]'); await shot('2-entry-cs');
  await p.keyboard.press('ArrowRight'); await shot('3-eu31');
  await p.selectOption('#s3-where', 'c:Italy'); await p.click('#s3-period [data-v="2020-2023"]'); await p.click('#s3-third [data-v=employer]'); await shot('3-italy-2020-employer');
  await p.selectOption('#s3-where', 'c:Malta'); await p.click('#s3-third [data-v=later]'); await shot('3-malta');
  await p.keyboard.press('ArrowRight'); await shot('4-map');
  await p.click('#s4-modes .chip:nth-child(4)'); await shot('4-map-change');
  await p.fill('#q', 'computer sci'); await p.waitForTimeout(200); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  const mb = await p.locator('#map').boundingBox(); await p.mouse.move(mb.x + mb.width / 2 + 30, mb.y + mb.height / 2 + 30); await shot('4-map-search');
  await p.click('#zreset'); await p.waitForTimeout(700); await p.fill('#q', ''); await p.click('#s4-shape [data-v=pts]'); await shot('4-points');
  await p.mouse.move(mb.x + mb.width * .52, mb.y + mb.height * .47); await p.mouse.wheel(0, -900); await p.waitForTimeout(300);
  await p.mouse.move(mb.x + mb.width * .52 + 6, mb.y + mb.height * .47 + 4); await shot('4-points-zoom');
  await p.setViewportSize({ width: 1280, height: 720 }); await p.goto(U + '#/3'); await p.reload(); await shot('3-small');
  console.log('errors:', JSON.stringify(errs));
  console.log(JSON.stringify(await p.evaluate(() => { const t = window.__deck.tally; return { all: t('r:ALL', [2015, 2023]), eu1519: t('r:EU31', [2015, 2019]), de: t('c:Germany', [2015, 2023]) }; })));
  await b.close();
})();
