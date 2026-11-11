/* Charts for the roundtable deck. All numbers come from data/deck_data.js (build/build_data.py). */
(function () {
'use strict';
const D = window.D, $ = id => document.getElementById(id);
/* interface palette; greys are tints of the brand black */
const P = {orange:'#FF7F48',blue:'#3C50FF',lav:'#E0E3FF',petrol:'#134550',steel:'#6C9FC6',mocha:'#DEA580',brown:'#713333',ecru:'#F9F4CA',black:'#202020',
  ink60:'rgba(32,32,32,.6)', ink30:'rgba(32,32,32,.3)', ink14:'rgba(32,32,32,.14)'};
const CS = 'CS / IT', FONT = 'Inter, Helvetica, Arial, sans-serif';
const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize);
const nf = n => Math.round(n).toLocaleString('en-US');
const p1 = v => v.toFixed(1) + '%';
const pts1 = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1);
const mil = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + ' million' : nf(n);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const rgba = (h, a) => 'rgba(' + [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16)).join(',') + ',' + a + ')';
const by = k => (a, b) => a[k] - b[k];
const ordinal = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const CFG = {displayModeBar: false, responsive: true};
const DATA_NAME = `Revelio Labs, online professional profiles, ${D.meta.basis.replace(' refresh', '')}`;
const SOURCE = `Source: ${DATA_NAME}. Graduates of universities in 31 European countries and the US since 2005`;
const GRADS = '110.3 million';   /* graduates in the report's population (report README) */

function lay(extra) {
  extra = extra || {};
  const r = rem(), ax = {gridcolor: P.ink14, zeroline: false, tickfont: {size: r * 0.9, color: P.ink60}, automargin: true};
  const out = Object.assign({font: {family: FONT, size: r * 0.95, color: P.black}, paper_bgcolor: '#fff', plot_bgcolor: '#fff',
    margin: {l: r * 5, r: r * 15, t: r * 1.2, b: r * 2.4}, showlegend: false, hoverlabel: {bgcolor: P.black, bordercolor: P.black, font: {family: FONT, size: r * 0.9, color: '#fff'}}}, extra);
  out.xaxis = Object.assign({}, ax, {showgrid: false, showline: true, linecolor: P.black, ticks: 'outside', ticklen: r * 0.3, tickcolor: P.black, dtick: 1}, extra.xaxis);
  out.yaxis = Object.assign({}, ax, {ticksuffix: '%', showline: false}, extra.yaxis);
  if (extra.ytitle) { out.yaxis.title = {text: extra.ytitle, font: {size: r * 0.9, color: P.black}, standoff: r * 0.8}; delete out.ytitle; }
  if (extra.span) { out.xaxis.range = [extra.span[0] - 0.5, extra.span[1] + 0.5]; delete out.span; }
  return out;
}
function line(rows, xk, name, color, opt, unit) {
  const r = rem();
  return Object.assign({type: 'scatter', mode: 'lines+markers', name, x: rows.map(d => d[xk]), y: rows.map(d => d.junior_pct), customdata: rows.map(d => d.n),
    line: {color, width: r * 0.22}, marker: {color, size: r * 0.5},
    hovertemplate: '<b>' + name + '</b><br>%{x}: %{y:.1f}%' + (rows[0].n == null ? '' : '<br>%{customdata:,.0f} ' + (unit || 'people')) + '<extra></extra>'}, opt || {});
}
/* one-line labels at the right end of each line, pushed apart so they never overlap, joined to their line by a hairline */
function endLabels(items, rng, gapFrac) {
  const r = rem(), gap = (rng[1] - rng[0]) * (gapFrac || 0.06), s = items.slice().sort((a, b) => b.y - a.y);
  s.forEach((d, i) => { d.ly = i && s[i - 1].ly - d.y < gap ? s[i - 1].ly - gap : d.y; });
  const low = rng[0] + gap * 0.4;
  for (let i = s.length - 1; i >= 0; i--) { const floor = i === s.length - 1 ? low : s[i + 1].ly + gap; if (s[i].ly < floor) s[i].ly = floor; }
  return s.map(d => ({x: d.x, y: d.y, xref: 'x', yref: 'y', ax: r * 1.6, axref: 'pixel', ay: d.ly, ayref: 'y', showarrow: true, arrowhead: 0, arrowwidth: 1, arrowcolor: P.ink30,
    text: d.text, xanchor: 'left', font: {size: r * (d.big ? 1 : 0.85), color: d.color}, align: 'left'}));
}
const startLabel = (d, xk, color, other) => ({x: d[xk], y: d.junior_pct, xref: 'x', yref: 'y', text: p1(d.junior_pct), showarrow: false, yshift: rem() * (other && other.junior_pct > d.junior_pct ? -1.1 : 1.1), font: {size: rem() * 0.95, color}});
function chips(id, fn) {
  const box = $(id);
  box.querySelectorAll('.chip').forEach(b => b.onclick = () => { box.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); fn(b.dataset.v); });
}
function fitPlot(el) { requestAnimationFrame(() => { if (!el || !el.data || !el._fullLayout) return;
  if (Math.abs(el._fullLayout.width - el.clientWidth) > 1 || Math.abs(el._fullLayout.height - el.clientHeight) > 1) Plotly.Plots.resize(el); }); }
/* switching between views: a short fade out, redraw, fade in */
function crossfade(el, draw) {
  if (!el.data) { draw(); return; }
  el.classList.remove('drawin', 'fadeothers', 'morph'); el.style.transition = 'opacity .16s ease'; el.style.opacity = 0; clearTimeout(el._cf);
  el._cf = setTimeout(() => { draw(); requestAnimationFrame(() => { el.style.transition = 'opacity .34s ease'; el.style.opacity = 1; }); }, 170);
}
const MORPH = {duration: 600, easing: 'cubic-in-out'};
/* lines draw in from the left when a chart first appears or changes shape */
function drawIn(el) { el.classList.remove('drawin'); void el.offsetWidth; el.classList.add('drawin'); }
function countTo(el, to, fmt) {
  const from = el._v == null ? to : el._v, t0 = performance.now(); el._v = to; cancelAnimationFrame(el._raf);
  if (from === to) { el.textContent = fmt(to); return; }
  (function step(now) { const t = Math.min(1, (now - t0) / 450), e = 1 - Math.pow(1 - t, 3); el.textContent = fmt(from + (to - from) * e); if (t < 1) el._raf = requestAnimationFrame(step); })(t0);
}

/* ------------------------------------------------------------ title */
$('m-int').textContent = mil(D.meta.internships).replace(' million', 'M');
(function () {
  const c0 = [255, 127, 72], c1 = [224, 227, 255], cols = 48, rows = 3;
  let h = '', seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const t = Math.min(1, Math.max(0, c / (cols - 1) + (rnd() - .5) * .35));
    h += '<i style="background:rgb(' + c0.map((v, k) => Math.round(v + (c1[k] - v) * t)).join(',') + ')"></i>';
  }
  $('mosaic').innerHTML = h;
})();

/* ------------------------------------------------------------ 1: junior share, AI talent vs other graduates */
/* default: the report's like-for-like measure (jobs held in the first five years after graduating); 'old' = the earlier measure, kept to show why it misleads */
const S1 = {view: 'share'}, PIVOT = D.meta.pivot, FULL = D.meta.last_full_year;
/* band and note over the partial last year of a calendar-year chart */
const provBand = y => ({type: 'rect', xref: 'x', yref: 'paper', x0: y - 0.5, x1: y + 0.5, y0: 0, y1: 1, fillcolor: rgba(P.mocha, .22), line: {width: 0}, layer: 'below'});
const provNote = y => ({x: y + 0.5, xanchor: 'right', y: 1, xref: 'x', yref: 'paper', yanchor: 'bottom', text: y + ': January to September, provisional', showarrow: false, font: {size: rem() * 0.8, color: P.brown}});
function drawS1(morph) {
  const old = S1.view === 'old', src = old ? D.junior_ai : D.first5_ai, el = $('s1-plot'), r = rem();
  const ai = src.filter(d => d.grp === 'AI talent').sort(by('cal_year')), ot = src.filter(d => d.grp === 'Other graduates').sort(by('cal_year'));
  const a0 = ai[0], a1 = ai[ai.length - 1], o0 = ot[0], o1 = ot[ot.length - 1], y0 = a0.cal_year, y1 = a1.cal_year;
  const at = (rows, y) => rows.find(d => d.cal_year === y).junior_pct, at2 = (rows, y) => rows.find(d => d.cal_year === y).n, vals = ai.concat(ot).map(d => d.junior_pct);
  const rng = [Math.floor(Math.min(...vals) / 5) * 5, Math.ceil(Math.max(...vals) / 5) * 5 + (old ? 0 : 5)];
  const ytitle = old ? 'Share of all graduates since 2005 in work who are in a junior role' : 'Share of early-career graduates in work who are in a junior role';
  if (S1.view === 'gap') {
    const gap = ai.map((d, i) => ({cal_year: d.cal_year, v: d.junior_pct - ot[i].junior_pct}));
    $('s1-sub').innerHTML = `The difference between the two lines. AI talent was <b>${Math.abs(gap.find(d => d.cal_year === PIVOT).v).toFixed(1)} percentage points</b> below other graduates in ${PIVOT}, about where it had been since ${y0}, and <b>${Math.abs(gap.find(d => d.cal_year === FULL).v).toFixed(1)} points</b> below in ${FULL}.`;
    Plotly.react(el, [{type: 'bar', x: gap.map(d => d.cal_year), y: gap.map(d => d.v), marker: {color: P.orange},
      text: gap.map(d => pts1(d.v)), textposition: 'outside', textfont: {size: r * 0.95, color: P.black}, cliponaxis: false, hovertemplate: '%{x}: %{y:.1f} points<extra></extra>'}],
      lay({span: [y0, y1], ytitle: 'Share in junior roles: AI talent minus other graduates, percentage points', margin: {l: r * 5, r: r * 2, t: r * 1.2, b: r * 2.4},
        yaxis: {range: [Math.floor(Math.min(...gap.map(d => d.v)) - 2), 0], ticksuffix: ''}, bargap: .35, shapes: [provBand(y1)], annotations: [provNote(y1)]}), CFG);
  } else {
    $('s1-sub').innerHTML = old
      ? `The same question for <b>everyone</b> who graduated since 2005. Each year they gain a year of experience, so most of this fall is people moving above junior level. Use the first-five-years view to compare.`
      : `Graduates in their first five years at work: out of every 100 in work, how many are in a junior role (the two lowest of seven seniority levels). Steady until ${PIVOT}; by ${FULL} down <b>${Math.abs(at(ai, FULL) - at(ai, PIVOT)).toFixed(1)} percentage points</b> for AI talent and <b>${Math.abs(at(ot, FULL) - at(ot, PIVOT)).toFixed(1)}</b> for other graduates.`;
    const marks = (old ? [] : [{type: 'line', xref: 'x', yref: 'paper', x0: PIVOT, x1: PIVOT, y0: 0, y1: 1, line: {color: P.ink30, width: 1, dash: 'dot'}}]).concat([provBand(y1)]);
    Plotly.react(el, [line(ot, 'cal_year', 'Other graduates', P.steel, null, 'jobs'), line(ai, 'cal_year', 'AI talent', P.orange, null, 'jobs')],
      lay({span: [y0, y1], ytitle, yaxis: {range: rng}, shapes: marks, transition: morph === true ? MORPH : undefined, annotations: endLabels([{x: y1, y: o1.junior_pct, text: 'Other graduates <b>' + p1(o1.junior_pct) + '</b>', color: P.steel, big: 1},
        {x: y1, y: a1.junior_pct, text: 'AI talent <b>' + p1(a1.junior_pct) + '</b>', color: P.orange, big: 1}], rng).concat([startLabel(o0, 'cal_year', P.steel, a0), startLabel(a0, 'cal_year', P.orange, o0), provNote(y1)])}), CFG);
  }
  $('s1-src').textContent = `${SOURCE}. ` + (old ? `Every job started since 2015 is counted, for all graduates since 2005. ` : `Every job held in the graduation year or the five years after is counted, once per year (${mil(at2(ai, FULL) + at2(ot, FULL))} in ${FULL}). With the same mix of years since graduation in every year, the fall from ${PIVOT} to ${FULL} is ${Math.abs(D.meta.fixed_mix['AI talent']).toFixed(1)} points for AI talent and ${Math.abs(D.meta.fixed_mix['Other graduates']).toFixed(1)} for other graduates. `) +
    `Junior role: the two lowest of seven seniority levels. AI talent: people whose profile today matches interface's AI-talent definition, counted as such in earlier years too.` + (S1.view === 'gap' ? '' : ` The vertical axis starts at ${rng[0]}%.`);
  if (morph === true) { el.classList.remove('drawin', 'morph'); void el.offsetWidth; el.classList.add('morph'); }
  fitPlot(el);
}
chips('s1-chips', v => { const prev = S1.view, el = $('s1-plot'); if (v === prev) return; S1.view = v;
  if (v === 'gap' || prev === 'gap') crossfade(el, () => drawS1()); else { clearTimeout(el._cf); el.style.opacity = 1; drawS1(true); } });

/* ------------------------------------------------------------ 2: CS vs other fields */
const S2 = {measure: 'stock', view: 'cs'};
function drawS2(fadeOthers) {
  const stock = S2.measure === 'stock', xk = stock ? 'cal_year' : 'cohort', el = $('s2-plot'), r = rem(), unit = stock ? 'jobs' : 'graduates';
  const csRows = stock ? D.stock_cs : D.entry_cs, fld = stock ? D.stock_field : D.entry_field;
  const ytitle = stock ? 'Share of early-career graduates in work who are in a junior role' : 'Share of new graduates whose first job is a junior role';
  const lead = stock ? 'Graduates in their first five years at work: out of every 100 in work, how many are in a junior role.' : 'Graduates who found work: out of every 100, how many started in a junior role. A starting job is any job begun from 6 months before to 2 years after graduating.';
  const xs = fld.map(d => d[xk]), first = Math.min(...xs), last = Math.max(...xs);
  /* change window: since 2021 for people in work (flat before); 2019 to 2024 graduates for first jobs (the series peaks around 2019; 2024 is the last year with a complete two-year window) */
  const from = stock ? PIVOT : 2019, to = stock ? FULL : 2024;
  const rng = [Math.floor(Math.min(...fld.map(d => d.junior_pct)) / 5) * 5, Math.ceil(Math.max(...fld.map(d => d.junior_pct)) / 5) * 5];
  const xt = stock ? {title: {text: 'Year', font: {size: r * 0.9}}} : {dtick: 2, title: {text: 'Year of graduation', font: {size: r * 0.9}}};
  const shapes = stock ? [{type: 'line', xref: 'x', yref: 'paper', x0: PIVOT, x1: PIVOT, y0: 0, y1: 1, line: {color: P.ink30, width: 1, dash: 'dot'}}, provBand(last)]
    : [{type: 'rect', xref: 'x', yref: 'paper', x0: Math.min(...D.meta.partial_cohorts) - 0.5, x1: last + 0.5, y0: 0, y1: 1, fillcolor: rgba(P.mocha, .22), line: {width: 0}, layer: 'below'}];
  const partial = stock ? [provNote(last)] : [{x: last + 0.5, xanchor: 'right', y: 1, xref: 'x', yref: 'paper', yanchor: 'bottom', text: D.meta.partial_cohorts.join(' and ') + ' graduates: under 2 years of history so far', showarrow: false, font: {size: r * 0.8, color: P.brown}}];
  if (el.removeAllListeners) { el.removeAllListeners('plotly_hover'); el.removeAllListeners('plotly_unhover'); }
  el.classList.remove('fadeothers');
  if (S2.view === 'cs') {
    const c = csRows.filter(d => d.grp === 'CS').sort(by(xk)), n = csRows.filter(d => d.grp === 'non-CS').sort(by(xk));
    const c0 = c[0], c1 = c[c.length - 1], n0 = n[0], n1 = n[n.length - 1], at = (rows, x) => rows.find(d => d[xk] === x).junior_pct;
    $('s2-sub').innerHTML = lead + (stock ? ` From ${from} to ${to} the share fell` : ` For those who graduated in ${to} compared with ${from}, the share is down`) + ` <b>${Math.abs(at(c, to) - at(c, from)).toFixed(1)} percentage points</b> for computer science and <b>${Math.abs(at(n, to) - at(n, from)).toFixed(1)}</b> for all other degrees.`;
    Plotly.react(el, [line(n, xk, 'All other degrees', P.steel, null, unit), line(c, xk, 'Computer science', P.orange, null, unit)],
      lay({span: [first, last], ytitle, xaxis: xt, yaxis: {range: rng}, shapes, annotations: endLabels([{x: n1[xk], y: n1.junior_pct, text: 'All other degrees <b>' + p1(n1.junior_pct) + '</b>', color: P.steel, big: 1},
        {x: c1[xk], y: c1.junior_pct, text: 'Computer science <b>' + p1(c1.junior_pct) + '</b>', color: P.orange, big: 1}], rng).concat([startLabel(n0, xk, P.steel, c0), startLabel(c0, xk, P.orange, n0)], partial)}), CFG);
  } else {
    const groups = [...new Set(fld.map(d => d.fgroup))].sort((a, b) => (a === CS) - (b === CS) || a.localeCompare(b));
    const val = (g, x) => fld.find(d => d.fgroup === g && d[xk] === x).junior_pct, nice = g => g === CS ? 'Computer science' : g;
    const chg = groups.map(g => ({g, d: val(g, to) - val(g, from)})).sort((a, b) => a.d - b.d);
    const rank = chg.findIndex(d => d.g === CS) + 1, top3 = chg.slice(0, 3).map(d => `${esc(nice(d.g))} ${Math.abs(d.d).toFixed(1)}`).join(', ');
    $('s2-sub').innerHTML = `${lead} Largest falls${stock ? ` from ${from} to ${to}` : `, ${to} graduates compared with ${from}`}, in percentage points: <b>${top3}</b>.` +
      (rank > 3 ? ` Computer science: <b>${Math.abs(chg[rank - 1].d).toFixed(1)}</b>, ${ordinal(rank)} of 15.` : '');
    const col = g => g === CS ? P.orange : g === 'Law' ? P.petrol : P.ink30, wid = g => g === CS ? r * 0.3 : g === 'Law' ? r * 0.22 : r * 0.12;
    const traces = groups.map(g => line(fld.filter(d => d.fgroup === g).sort(by(xk)), xk, nice(g), col(g), {mode: 'lines', line: {color: col(g), width: wid(g)}}, unit));
    const labels = hot => endLabels(groups.map(g => ({x: last, y: val(g, last), text: g === CS ? '<b>Computer science ' + p1(val(g, last)) + '</b>' : esc(g) + ' ' + p1(val(g, last)),
      color: g === CS ? P.orange : g === hot ? P.blue : g === 'Law' ? P.petrol : P.ink60, big: g === CS || g === hot || g === 'Law'})), rng, 0.058).concat(partial);
    Plotly.react(el, traces, lay({span: [first, last], ytitle, xaxis: xt, yaxis: {range: rng}, shapes, hovermode: 'closest', annotations: labels()}), CFG);
    el.on('plotly_hover', ev => { const i = ev.points[0].curveNumber, g = groups[i]; if (g === CS || g === 'Law') return;
      Plotly.restyle(el, {'line.color': groups.map((x, j) => j === i ? P.blue : col(x)), 'line.width': groups.map((x, j) => j === i ? r * 0.26 : wid(x))});
      Plotly.relayout(el, {annotations: labels(g)}); });
    el.on('plotly_unhover', () => { Plotly.restyle(el, {'line.color': groups.map(col), 'line.width': groups.map(wid)}); Plotly.relayout(el, {annotations: labels()}); });
  }
  const win = D.meta.last_cohort_months;
  $('s2-src').textContent = `${SOURCE}. Degrees are sorted into 15 groups by the degree name each graduate entered, in any language; each person counts under their highest degree. Junior role: the two lowest of seven seniority levels. ` +
    (stock ? `Every job held in the graduation year or the five years after is counted, once per year; ${D.meta.unclassified_pct}% belong to people with no usable degree name and are left out. `
           : `If a graduate began several jobs in that window, the lowest level counts; internships are included. ${D.meta.partial_cohorts.join(' and ')} graduates have ${win[0]} to ${win[1]} months of history so far. `) + `The vertical axis starts at ${rng[0]}%.`;
  /* arriving on the 15-field view from the two-line view of the same measure: computer science stays put, the other 14 fade in */
  if (fadeOthers === true) { el.classList.remove('drawin', 'morph'); void el.offsetWidth; el.classList.add('fadeothers'); }
  fitPlot(el);
}
chips('s2-measure', v => { if (v === S2.measure) return; S2.measure = v; crossfade($('s2-plot'), () => drawS2()); });
chips('s2-view', v => { if (v === S2.view) return; S2.view = v; const el = $('s2-plot');
  if (v === 'all') { clearTimeout(el._cf); el.style.opacity = 1; drawS2(true); } else crossfade(el, () => drawS2()); });

/* ------------------------------------------------------------ 3: internships */
const F = D.flows, S3 = {where: 'r:EU31', period: [2015, 2023], third: 'later'};
const REG = {'r:EU31': {label: 'Europe (31 countries)', set: new Set(F.eu31)}, 'r:EU27': {label: 'EU-27', set: new Set(F.eu27)},
  'r:US': {label: 'United States', set: new Set(['United States'])}, 'r:ALL': {label: 'All countries worldwide', set: null}};
(function () {
  const sel = $('s3-where'), og = (label, items) => { const g = document.createElement('optgroup'); g.label = label;
    items.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; g.appendChild(o); }); sel.appendChild(g); };
  og('Regions', Object.entries(REG).map(([k, v]) => [k, v.label]));
  og('European countries', F.eu31.slice().sort().map(c => ['c:' + c, c]));
  sel.value = S3.where; sel.onchange = () => { S3.where = sel.value; drawS3(); };
})();
const whereLabel = w => w.startsWith('r:') ? REG[w].label : w.slice(2);
function tally(where, period) {
  const set = where.startsWith('r:') ? REG[where].set : new Set([where.slice(2)]);
  const t = {n: 0, s2: F.s2.map(() => 0), co: F.s2.map(() => F.co.map(() => 0)), s3: F.s3.map(() => 0)};
  for (const [c, y, s, o, k, n] of F.rows) {
    if (y < period[0] || y > period[1] || (set && !set.has(F.countries[c]))) continue;
    t.n += n; t.s2[s] += n; if (o >= 0) t.co[s][o] += n; if (k >= 0) t.s3[k] += n;
  }
  const jobs = t.s2[0] + t.s2[1];
  t.job = 100 * jobs / t.n; t.same = 100 * (t.co[0][0] + t.co[1][0]) / jobs; t.up = 100 * t.s3[0] / t.s2[0];
  return t;
}
/* nodes: 0 internship | 1-5 first outcome within 12 months | 6-7 the later step */
const N2 = [{label: 'Junior job', color: P.petrol}, {label: 'Straight to a job above junior level', color: P.blue}, {label: 'Another internship', color: P.steel},
  {label: 'Back to study', color: P.mocha}, {label: 'Nothing listed next (not necessarily out of work)', color: 'rgba(32,32,32,.28)'}];
const N3 = {later: [{label: 'Moved above junior level', color: rgba(P.blue, .55)}, {label: 'No job above junior level', color: rgba(P.petrol, .5)}],
  employer: [{label: 'Hired by the internship employer', color: P.brown}, {label: 'Hired by another employer', color: rgba(P.brown, .4)}]};
const HEAD3 = {later: 'Two years after the junior job starts', employer: 'Who hired them (junior jobs and above)'};
function drawS3() {
  const t = tally(S3.where, S3.period), base = S3.where === 'r:EU31' ? null : tally('r:EU31', S3.period), r = rem(), el = $('s3-plot'), later = S3.third === 'later';
  const v2 = t.s2.slice();
  /* third column: either the two-year step of junior hires, or who hired everyone who got a job (employer not identified counts as another employer) */
  const v3 = later ? t.s3.slice() : [t.co[0][0] + t.co[1][0], t.co[0][1] + t.co[1][1] + t.co[0][2] + t.co[1][2]];
  const links = [];
  v2.forEach((v, i) => links.push([0, 1 + i, v, null]));
  if (later) v3.forEach((v, k) => links.push([1, 6 + k, v, [t.s2[0], 'people in a junior job']]));
  else [0, 1].forEach(i => { const of = [t.s2[i], i ? 'people in a job above junior level' : 'people in a junior job']; links.push([1 + i, 6, t.co[i][0], of]); links.push([1 + i, 7, t.co[i][1] + t.co[i][2], of]); });
  /* fixed columns: outcomes that end the story stop in the middle; the later step sits further right because it happens later */
  const H = Math.max(200, el.clientHeight - r * 1.6), padPx = r * 1.3, pad = padPx / H, live2 = v2.filter(v => v > 0).length;
  const s = (1 - live2 * pad) / t.n, y = [0.5], x = [0.001];   /* one spare gap: the later column has one more gap than its parent */
  const goesOn = i => i === 0 || (!later && i === 1), order = [0, 1, 2, 3, 4].filter(i => !goesOn(i)).concat([0, 1, 2, 3, 4].filter(goesOn));
  let cur = 0; const y2 = [], top2 = [];
  order.forEach(i => { top2[i] = cur; y2[i] = cur + v2[i] * s / 2; if (v2[i] > 0) cur += v2[i] * s + pad; });
  y2.forEach(v => { y.push(v); x.push(0.5); });
  cur = top2[order.find(goesOn)];
  v3.forEach(v => { y.push(cur + v * s / 2); x.push(0.999); cur += v * s + pad; });
  const clampY = v => Math.min(0.999, Math.max(0.001, v));
  const names = ['Internship', ...N2.map(n => n.label), ...N3[S3.third].map(n => n.label)], vals = [t.n, ...v2, ...v3];
  const colors = [P.black, ...N2.map(n => n.color), ...N3[S3.third].map(n => n.color)];
  const lab = names.map((n, i) => i === 0 ? 'Internship' : `${n} <b>${(100 * vals[i] / t.n).toFixed(1)}%</b>`);
  const keep = links.filter(l => l[2] > 0), hl = {bgcolor: P.black, bordercolor: P.black, font: {family: FONT, size: r * 0.9, color: '#fff'}};
  const tint = c => c.startsWith('#') ? rgba(c, .4) : c.replace(/[\d.]+\)$/, m => (parseFloat(m) * .6).toFixed(2) + ')');
  Plotly.react(el, [{type: 'sankey', orientation: 'h', arrangement: 'fixed',
    node: {pad: padPx, thickness: r * 1.1, line: {width: 0}, label: lab, color: colors, x, y: y.map(clampY), hoverlabel: hl,
      customdata: names.map((n, i) => n + '<br>' + (100 * vals[i] / t.n).toFixed(1) + ' of every 100 internships'),
      hovertemplate: '<b>%{customdata}</b><br>%{value:,} people<extra></extra>'},
    link: {source: keep.map(l => l[0]), target: keep.map(l => l[1]), value: keep.map(l => l[2]), hoverlabel: hl, color: keep.map(l => tint(colors[l[1]])),
      customdata: keep.map(l => `<b>${names[l[0]]} → ${names[l[1]]}</b><br>${nf(l[2])} people<br>${(100 * l[2] / t.n).toFixed(1)} of every 100 internships` + (l[3] ? `<br>${(100 * l[2] / l[3][0]).toFixed(1)} of every 100 ${l[3][1]}` : '')),
      hovertemplate: '%{customdata}<extra></extra>'},
    textfont: {family: FONT, size: r * 0.95, color: P.black}}],
    {font: {family: FONT, size: r * 0.95, color: P.black}, paper_bgcolor: '#fff', margin: {l: r * 0.3, r: r * 0.3, t: r * 0.8, b: r * 0.8}, hoverlabel: hl}, CFG);
  $('s3-h3').textContent = HEAD3[S3.third];
  const per = S3.period[0] + '–' + String(S3.period[1]).slice(2), cmp = v => base ? `Europe overall: ${v}` : '', small = t.n < 5000 ? ' · small group, read with care' : '';
  countTo($('k-n'), t.n, v => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : nf(v)); $('k-n-c').textContent = `${whereLabel(S3.where)}, started ${per}${small}`;
  countTo($('k-job'), t.job, p1); $('k-job-c').textContent = cmp(base && p1(base.job));
  countTo($('k-same'), t.same, p1); $('k-same-c').textContent = cmp(base && p1(base.same));
  countTo($('k-up'), t.up, p1); $('k-up-c').textContent = cmp(base && p1(base.up));
  $('s3-sub').innerHTML = later
    ? `Each person's first internship, and what their profile shows next. People who take a junior job are followed for two more years: do they move up?`
    : `Each person's first internship, and what their profile shows next. For those who got a job: was it with the employer where they interned?`;
  $('s3-src').textContent = `Source: ${DATA_NAME}. Each person's first internship, started between 2015 and 2023 and ended by October 2023, so that everyone can be followed for three more years. Country is where the internship took place. "Nothing listed next" can mean out of work, working somewhere not on the profile, or a profile that was not updated.`;
  fitPlot(el);
}
chips('s3-period', v => { S3.period = v.split('-').map(Number); drawS3(); });
chips('s3-third', v => { S3.third = v; drawS3(); });

/* ------------------------------------------------------------ 4: map of degree names (hexagons or single names) */
let mapResize = null;
function initMap() {
  const FM = D.field_map, S = FM.hex_size, OX = FM.origin[0], OY = FM.origin[1], H = FM.hexes, SQ = Math.sqrt(3), PT = D.points.rows, PG = D.points.groups;
  H.forEach(h => { h.x = OX + S * SQ * (h.q + h.r / 2); h.y = OY + S * 1.5 * h.r; });
  const index = new Map(); H.forEach((h, i) => index.set(h.q + ',' + h.r, i));
  const groups = [...new Set(H.map(h => h.group))].sort(), nice = g => g === CS ? 'Computer science' : g;
  /* field colours: the report's mapping where it has one, tints of the palette for the rest */
  const GC = {'CS / IT': P.orange, 'Engineering & Technology': P.steel, 'Business & Economics': P.mocha, 'Humanities & Languages': '#8B7355', 'Health & Medicine': P.brown,
    'Education & Teaching': '#B9BEF5', 'Natural Sciences & Math': P.petrol, 'Architecture & Built Environment': '#B08968', 'Law': '#9a7b4f', 'Other / Non-degree': '#b8b4ae',
    'Social Sciences': P.blue, 'Arts, Media & Design': '#F2B79A', 'Agriculture & Environment': '#5E8D97', 'Psychology & Social Work': '#A97C7C', 'Skills & Short Courses': '#D9CF8E'};
  const h2r = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
  const ramp = stops => { const c = stops.map(h2r); return t => { t = Math.max(0, Math.min(1, t)); const x = t * (c.length - 1), i = Math.min(c.length - 2, Math.floor(x)), f = x - i;
    return 'rgb(' + [0, 1, 2].map(k => Math.round(c[i][k] + (c[i + 1][k] - c[i][k]) * f)).join(',') + ')'; }; };
  const quant = (a, p) => { a = a.filter(v => v != null).sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * (a.length - 1)))]; };
  const both = H.flatMap(h => [h.j_pre, h.j_post]), jd = [quant(both, .02), quant(both, .98)];
  const chg = h => h.j_pre == null || h.j_post == null ? null : h.j_post - h.j_pre, cm = quant(H.map(chg).map(v => v == null ? null : Math.abs(v)), .98);
  const aid = [0, quant(H.map(h => h.ai), .98)];
  const SEQ = ramp([P.ecru, P.orange, P.brown]), DIV = ramp([P.petrol, '#f4f4f4', P.orange]), AI = ramp([P.lav, P.blue, P.petrol]);
  const num = (v, d) => v.toFixed(d), NA = 'rgba(32,32,32,.12)';
  const MODES = {field: {pill: 'Field of study'},
    pre: {pill: 'Started in a junior role, 2015–19 graduates', get: h => h.j_pre, col: v => SEQ((v - jd[0]) / (jd[1] - jd[0])), dom: jd, ramp: SEQ, fmt: v => num(v, 0) + '%'},
    post: {pill: 'Started in a junior role, 2023–24 graduates', get: h => h.j_post, col: v => SEQ((v - jd[0]) / (jd[1] - jd[0])), dom: jd, ramp: SEQ, fmt: v => num(v, 0) + '%'},
    chg: {pill: 'Change from 2015–19 to 2023–24', get: chg, col: v => DIV((v + cm) / (2 * cm)), dom: [-cm, cm], ramp: DIV, fmt: v => (v > 0 ? '+' : '') + num(v, 0) + ' percentage points'},
    ai: {pill: 'Share who are AI talent', get: h => h.ai, col: v => AI((v - aid[0]) / (aid[1] - aid[0])), dom: aid, ramp: AI, fmt: v => num(v, 0) + '%'}};
  /* one label per field, at its most populated hexagon */
  const LAB = groups.filter(g => g !== 'Other / Non-degree' && g !== 'Skills & Short Courses').map(g => ({g, h: H.filter(h => h.group === g).reduce((a, b) => b.n26 > a.n26 ? b : a)}));
  /* spatial grid for point hover */
  const CELL = S * 2, pgrid = new Map();
  PT.forEach((p, i) => { const key = Math.floor(p[0] / CELL) + ',' + Math.floor(p[1] / CELL); if (!pgrid.has(key)) pgrid.set(key, []); pgrid.get(key).push(i); });
  const maxN = Math.max(...PT.map(p => p[3]));
  let mode = 'field', shape = 'hex', cols = [], focus = null, marker = null, touched = false, mix = 0;   /* mix: 0 = hexagons, 1 = points */
  const cv = $('map'), ctx = cv.getContext('2d'), tip = $('tip');
  let W = 0, HT = 0, dpr = 1, k = 1, tx = 0, ty = 0, fitK = 1;
  const minX = Math.min(...H.map(h => h.x)) - S, maxX = Math.max(...H.map(h => h.x)) + S, minY = Math.min(...H.map(h => h.y)) - S, maxY = Math.max(...H.map(h => h.y)) + S;
  const VX = [0, 1, 2, 3, 4, 5].map(i => Math.cos(Math.PI / 180 * (60 * i - 30))), VY = [0, 1, 2, 3, 4, 5].map(i => Math.sin(Math.PI / 180 * (60 * i - 30)));
  const fitScale = () => Math.min(W / (maxX - minX), HT / (maxY - minY)) * .97;
  function fit() { fitK = fitScale(); k = fitK; tx = W / 2 - (minX + maxX) / 2 * k; ty = HT / 2 - (minY + maxY) / 2 * k; }
  function paintHex(alpha) { const R = S * k * 1.03;
    for (let i = 0; i < H.length; i++) { const h = H[i], sx = h.x * k + tx, sy = h.y * k + ty; if (sx < -R || sy < -R || sx > W + R || sy > HT + R) continue;
      ctx.globalAlpha = alpha * (focus && h.group !== focus ? .1 : 1);
      ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(sx + VX[0] * R, sy + VY[0] * R); for (let j = 1; j < 6; j++) ctx.lineTo(sx + VX[j] * R, sy + VY[j] * R); ctx.closePath(); ctx.fill(); } }
  const prad = n => Math.max(.7, Math.min(10, (0.6 + 13 * Math.sqrt(n / maxN)) * Math.sqrt(k / fitK)));
  function paintPts(alpha) {
    for (let i = 0; i < PT.length; i++) { const p = PT[i], sx = p[0] * k + tx, sy = p[1] * k + ty; if (sx < -10 || sy < -10 || sx > W + 10 || sy > HT + 10) continue;
      const g = PG[p[2]], rr = prad(p[3]); ctx.globalAlpha = alpha * (focus && g !== focus ? .06 : rr > 2 ? .85 : .55); ctx.fillStyle = GC[g] || P.black;
      if (rr < 1.6) ctx.fillRect(sx - rr, sy - rr, rr * 2, rr * 2); else { ctx.beginPath(); ctx.arc(sx, sy, rr, 0, 6.2832); ctx.fill(); } } }
  function paintLabels() { if (mode !== 'field' || k > fitK * 3) return; const r = rem(); ctx.font = '500 ' + r * .82 + 'px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    const placed = [];
    LAB.forEach(l => { if (focus && l.g !== focus) return; const t = nice(l.g), w = ctx.measureText(t).width, sx = l.h.x * k + tx; let sy = l.h.y * k + ty - r * .9;
      for (let n = 0; n < 6 && placed.some(b => Math.abs(b.x - sx) < (b.w + w) / 2 + 6 && Math.abs(b.y - sy) < r * 1.1); n++) sy -= r * 1.1;
      placed.push({x: sx, y: sy, w}); ctx.globalAlpha = 1; ctx.lineWidth = r * .32; ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.strokeText(t, sx, sy); ctx.fillStyle = P.black; ctx.fillText(t, sx, sy); });
    ctx.textAlign = 'left'; }
  function paint() { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, HT);
    if (mix < 1) paintHex(1 - mix); if (mix > 0) paintPts(mix); ctx.globalAlpha = 1; paintLabels();
    if (marker) { const sx = marker.x * k + tx, sy = marker.y * k + ty, r = rem(); ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, sy, r * .8, 0, 7); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = P.black; ctx.beginPath(); ctx.arc(sx, sy, r * .8, 0, 7); ctx.stroke();
      ctx.font = '500 ' + r * .95 + 'px Inter, sans-serif'; const w = ctx.measureText(marker.label).width, lx = Math.min(Math.max(sx - w / 2, r), W - w - r);
      ctx.fillStyle = P.black; ctx.fillRect(lx - r * .4, sy - r * 2.9, w + r * .8, r * 1.6); ctx.fillStyle = '#fff'; ctx.fillText(marker.label, lx, sy - r * 1.8); } }
  function colour() { cols = H.map(h => { if (mode === 'field') return GC[h.group]; const m = MODES[mode], v = m.get(h); return v == null ? NA : m.col(v); }); paint(); legend(); }
  function legend() { const el = $('maplegend'); el.innerHTML = '';
    if (mode === 'field') { el.className = 'legend'; groups.forEach(g => { const c = document.createElement('button'); c.type = 'button'; c.className = 'lchip' + (focus && focus !== g ? ' dim' : '');
      c.innerHTML = `<i style="background:${GC[g]}"></i>${esc(nice(g))}`; c.onclick = () => { focus = focus === g ? null : g; legend(); paint(); }; el.appendChild(c); }); return; }
    el.className = 'scale'; const m = MODES[mode]; let sw = '';
    for (let i = 0; i < 24; i++) sw += `<i style="background:${m.ramp(i / 23)}"></i>`;
    el.innerHTML = `<div class="sw">${sw}</div><div class="ends"><span>${m.fmt(m.dom[0])}</span><span>${m.fmt(m.dom[1])}</span></div>` +
      `<div class="nt">${mode === 'chg' ? 'Dark teal: a smaller share started in a junior role than in 2015–19. Orange: a larger share. ' : ''}Pale grey: fewer than 30 graduates with a first job in those years. Values beyond the two ends use the end colours.` +
      (focus ? ` Showing ${esc(nice(focus))} only.` : '') + '</div>'; }
  function resize() { const r = cv.getBoundingClientRect(); if (r.width < 10 || r.height < 10) return; dpr = window.devicePixelRatio || 1; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); W = r.width; HT = r.height; if (!touched) fit(); else fitK = fitScale(); paint(); }
  function zoomAt(px, py, f) { const nk = Math.max(fitK * .8, Math.min(fitK * 80, k * f)), r = nk / k; tx = px - (px - tx) * r; ty = py - (py - ty) * r; k = nk; touched = true; paint(); }
  let anim = 0;
  function animate(k2, tx2, ty2, ms, done) { const k0 = k, x0 = tx, y0 = ty, t0 = performance.now(), id = ++anim; touched = true;
    (function step(now) { if (id !== anim) return; const t = Math.min(1, (now - t0) / ms), e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      k = Math.exp(Math.log(k0) + (Math.log(k2) - Math.log(k0)) * e); tx = x0 + (tx2 - x0) * e; ty = y0 + (ty2 - y0) * e; paint(); if (t < 1) requestAnimationFrame(step); else if (done) done(); })(t0); }
  let mid = 0;
  function morph(to) { const from = mix, t0 = performance.now(), id = ++mid;
    (function step(now) { if (id !== mid) return; const t = Math.min(1, (now - t0) / 450); mix = from + (to - from) * t; paint(); if (t < 1) requestAnimationFrame(step); })(t0); }
  function hitHex(px, py) { const x = ((px - tx) / k - OX) / S, y = ((py - ty) / k - OY) / S, q = SQ / 3 * x - y / 3, r = 2 / 3 * y, cx = q, cz = r, cy = -q - r; let rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
    const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz); if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
    const i = index.get(rx + ',' + rz); return i == null ? -1 : i; }
  function hitPt(px, py) { const ux = (px - tx) / k, uy = (py - ty) / k, reach = 14 / k, span = Math.max(1, Math.ceil(reach / CELL)), gx = Math.floor(ux / CELL), gy = Math.floor(uy / CELL); let best = -1, bd = reach * reach;
    for (let a = -span; a <= span; a++) for (let b = -span; b <= span; b++) { const c = pgrid.get((gx + a) + ',' + (gy + b)); if (!c) continue;
      for (const i of c) { const p = PT[i]; if (focus && PG[p[2]] !== focus) continue; const d = (p[0] - ux) * (p[0] - ux) + (p[1] - uy) * (p[1] - uy); if (d < bd) { bd = d; best = i; } } }
    return best; }
  function place(px, py) { tip.style.display = 'block'; const w = tip.offsetWidth, hh = tip.offsetHeight; tip.style.left = Math.max(4, Math.min(W - w - 4, px + 14)) + 'px'; tip.style.top = Math.max(4, Math.min(HT - hh - 4, py + 14)) + 'px'; }
  function showTip(px, py) {
    if (shape === 'pts') { const i = hitPt(px, py); if (i < 0) { tip.style.display = 'none'; return; } const p = PT[i];
      tip.innerHTML = `<b>${esc(nice(PG[p[2]]))}</b><div style="margin:.3rem 0">“${esc(p[4])}”</div><div class="tf">written exactly like this by ${nf(p[3])} graduate${p[3] === 1 ? '' : 's'}</div>`; place(px, py); return; }
    const i = hitHex(px, py); if (i < 0) { tip.style.display = 'none'; return; } const h = H[i], row = (l, v, f) => `<div><span class="tf">${l}</span> ${v == null ? 'fewer than 30 graduates' : f(v)}</div>`;
    const c = chg(h); tip.innerHTML = `<b>${esc(nice(h.group))}</b><div style="margin:.3rem 0">${h.top.map(s => '“' + esc(s) + '”').join('<br>')}</div><div class="tf">${nf(h.fields)} degree names · ${nf(h.n26)} graduates</div>` +
      row('Started in a junior role, 2015–19 graduates:', h.j_pre, v => num(v, 1) + '%') + row('Started in a junior role, 2023–24 graduates:', h.j_post, v => num(v, 1) + '%') + row('Change:', c, v => (v > 0 ? '+' : '') + num(v, 1) + ' points') + row('AI talent:', h.ai, v => num(v, 1) + '%');
    place(px, py); }
  let drag = null, moved = 0;
  const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); drag = pos(e); moved = 0; anim++; cv.classList.add('drag'); });
  cv.addEventListener('pointermove', e => { const p = pos(e); if (!drag) { showTip(p[0], p[1]); return; }
    const dx = p[0] - drag[0], dy = p[1] - drag[1]; drag = p; moved += Math.abs(dx) + Math.abs(dy); if (moved > 5) { tx += dx; ty += dy; touched = true; tip.style.display = 'none'; paint(); } });
  const up = () => { drag = null; cv.classList.remove('drag'); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', () => { if (!drag) tip.style.display = 'none'; });
  cv.addEventListener('wheel', e => { e.preventDefault(); anim++; const p = pos(e); zoomAt(p[0], p[1], Math.exp(-e.deltaY * .0015)); }, {passive: false});
  $('zin').onclick = () => zoomAt(W / 2, HT / 2, 1.6); $('zout').onclick = () => zoomAt(W / 2, HT / 2, 1 / 1.6);
  $('zreset').onclick = () => { marker = null; const kk = fitScale(); animate(kk, W / 2 - (minX + maxX) / 2 * kk, HT / 2 - (minY + maxY) / 2 * kk, 500, () => { touched = false; }); };
  const pills = $('s4-modes');
  Object.entries(MODES).forEach(([key, m], i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (i ? '' : ' on'); b.textContent = m.pill;
    b.onclick = () => { mode = key; [...pills.children].forEach(x => x.classList.toggle('on', x === b)); colour(); }; pills.appendChild(b); });
  chips('s4-shape', v => { shape = v; if (v === 'pts' && mode !== 'field') { mode = 'field'; [...pills.children].forEach((x, i) => x.classList.toggle('on', i === 0)); colour(); }
    [...pills.children].forEach((x, i) => { x.disabled = v === 'pts' && i > 0; }); tip.style.display = 'none'; text(); morph(v === 'pts' ? 1 : 0); });
  const SL = FM.search.map(r => r.f.toLowerCase()), inp = $('q'), sug = $('sug'); let sel = -1, cur = [];
  function suggest() { const v = inp.value.trim().toLowerCase(); sug.innerHTML = ''; sel = -1; cur = []; if (!v) { sug.style.display = 'none'; marker = null; paint(); return; }
    const pre = [], sub = []; for (let i = 0; i < SL.length && pre.length < 8; i++) { const j = SL[i].indexOf(v); if (j === 0) pre.push(i); else if (j > 0 && sub.length < 8) sub.push(i); }
    cur = [...pre, ...sub].slice(0, 8); cur.forEach(i => { const li = document.createElement('li'), r = FM.search[i]; li.innerHTML = esc(r.f) + '<small>' + esc(nice(r.g)) + '</small>'; li.onmousedown = ev => { ev.preventDefault(); choose(i); }; sug.appendChild(li); });
    sug.style.display = cur.length ? 'block' : 'none'; }
  function choose(i) { const r = FM.search[i]; inp.value = r.f; sug.style.display = 'none'; marker = {x: r.x, y: r.y, label: r.f}; const k2 = fitK * 6; animate(k2, W / 2 - r.x * k2, HT / 2 - r.y * k2, 900); }
  inp.addEventListener('input', suggest); inp.addEventListener('blur', () => { sug.style.display = 'none'; });
  inp.addEventListener('keydown', e => { e.stopPropagation(); const li = [...sug.children];
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && li.length) { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + li.length) % li.length; li.forEach((x, i) => x.classList.toggle('hi', i === sel)); }
    else if (e.key === 'Enter' && cur.length) { e.preventDefault(); choose(cur[Math.max(sel, 0)]); } else if (e.key === 'Escape') { sug.style.display = 'none'; inp.blur(); } });
  const tot = H.reduce((a, h) => a + h.n26, 0);
  function text() {
    $('s4-sub').innerHTML = shape === 'hex'
      ? `Graduates write their degree in their own words, in any language: <b>${nf(FM.n_fields)}</b> different names, ignoring capitals and spacing. Names with similar wording and meaning sit close together; each hexagon groups nearby names.`
      : `Each dot is one degree name as graduates wrote it; bigger dots are used by more people. <b>${nf(PT.length)}</b> of the ${nf(FM.n_fields)} names are shown, with common names more likely to appear.`;
    $('s4-src').textContent = `Source: ${DATA_NAME}. A language model reads each degree name and places similar names together: closeness means similar wording and meaning, not similar careers. ` +
      (shape === 'hex' ? `The map is drawn from degree names in the Sept. 2025 data release and covers ${mil(tot)} of the ${GRADS} graduates; counts and shares use the Oct. 2026 data.` : 'Dot positions and sizes come from the Sept. 2025 data release.'); }
  text(); mapResize = resize; new ResizeObserver(resize).observe(cv); resize(); colour();
}

/* ------------------------------------------------------------ reveal wiring */
const DRAW = {s1: drawS1, s2: drawS2, s3: drawS3, s4: () => { if (mapResize) mapResize(); else initMap(); }};
function show(slide, arrive) { const k = slide && slide.dataset.chart; if (!k) return;
  requestAnimationFrame(() => { DRAW[k](); const el = $(k + '-plot'); if (arrive && el && k !== 's3') drawIn(el); }); }
Reveal.initialize({disableLayout: true, display: 'flex', controls: false, progress: true, hash: true, slideNumber: 'c/t',
  transition: 'fade', transitionSpeed: 'fast', touch: false, overview: false, center: false, help: false, pause: false})
  .then(() => { show(Reveal.getCurrentSlide(), true); Reveal.on('slidechanged', e => show(e.currentSlide, true)); });
/* presenter keys: 1-5 press the buttons of the current slide in order (first row, then second); select boxes keep their own arrow keys */
[1, 2, 3, 4, 5, 6].forEach(n => Reveal.addKeyBinding({keyCode: 48 + n, key: String(n)}, () => {
  const btn = [...Reveal.getCurrentSlide().querySelectorAll('.ctrl .chip:not(select), .side .chiprow .chip, .modes .chip')][n - 1]; if (btn && !btn.disabled) btn.click(); }));
document.querySelectorAll('select').forEach(el => el.addEventListener('keydown', e => e.stopPropagation()));
let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => show(Reveal.getCurrentSlide(), false), 150); });
window.__deck = {tally, S1, S2, S3};
})();
