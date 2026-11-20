/* Renders the country selector on slides 2 and 3 for large and small countries, and prints end-of-line values.
   Run: python3 -m http.server 8765 &   then   node build/qa_country.cjs <path to playwright module> */
const { chromium } = require(process.argv[2] || 'playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  const U = 'http://127.0.0.1:' + (process.env.PORT || 8765) + '/index.html', log = [];
  const shot = async n => { await p.waitForTimeout(1500); await p.screenshot({ path: `qa/${n}.png` }); };
  const labels = async (n, tag) => log.push(tag + ': ' + await p.evaluate(n => [...document.querySelectorAll('#s' + n + '-plot .annotation-text')].map(e => e.textContent).join(' | ') + ' || ' + document.getElementById('s' + n + '-how').textContent.slice(-150), n));
  await p.goto(U + '#/1'); await p.waitForTimeout(1500); await labels(1, 's1 all');
  for (const w of ['r:EU31', 'r:EU27', 'r:US', 'c:Germany', 'c:Italy', 'c:Malta']) { await p.selectOption('#s1-where', w); await shot('c1-' + w.slice(2)); await labels(1, 's1 ' + w); }
  await p.selectOption('#s1-where', 'c:Italy'); await p.click('#s1-chips [data-v=gap]'); await shot('c1-Italy-gap'); await labels(1, 's1 gap Italy');
  await p.selectOption('#s1-where', 'c:Malta'); await shot('c1-Malta-gap');
  await p.click('#s1-chips [data-v=old]'); await p.selectOption('#s1-where', 'c:Germany'); await shot('c1-Germany-old');
  await p.goto(U + '#/2'); await p.reload(); await p.waitForTimeout(1500); await labels(2, 's2 all');
  for (const w of ['r:EU31', 'c:Germany', 'c:Malta']) { await p.selectOption('#s2-where', w); await shot('c2-' + w.slice(2) + '-cs'); await labels(2, 's2 ' + w); }
  await p.selectOption('#s2-where', 'c:Italy'); await p.click('#s2-view [data-v=all]'); await shot('c2-Italy-all'); await labels(2, 's2 all Italy');
  await p.selectOption('#s2-where', 'c:Estonia'); await shot('c2-Estonia-all'); await labels(2, 's2 all Estonia');
  await p.click('#s2-measure [data-v=entry]'); await p.selectOption('#s2-where', 'c:France'); await shot('c2-France-entry-all'); await labels(2, 's2 entry France');
  await p.click('#s2-view [data-v=cs]'); await p.selectOption('#s2-where', 'r:EU27'); await shot('c2-EU27-entry-cs');
  await p.setViewportSize({ width: 1280, height: 720 }); await p.goto(U + '#/2'); await p.reload(); await p.selectOption('#s2-where', 'c:Germany'); await shot('c2-small');
  console.log('errors:', JSON.stringify(errs)); console.log(log.join('\n'));
  await b.close();
})();
