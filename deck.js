/* Charts for the roundtable deck. All numbers come from data/deck_data.js (build/build_data.py). */
(function () {
'use strict';
const D = window.D, $ = id => document.getElementById(id);
const P = {orange:'#FF7F48',blue:'#3C50FF',lav:'#E0E3FF',petrol:'#134550',steel:'#6C9FC6',mocha:'#DEA580',brown:'#713333',ecru:'#F9F4CA',black:'#202020',g1:'#8b8f96',g2:'#f2f3f5',g3:'#d6dadd'};
const PAL15 = ['#FF7F48','#3C50FF','#134550','#6C9FC6','#DEA580','#713333','#9AA4FF','#C9B93C','#FFB28F','#7F8794','#4F8A98','#A9C8E2','#B3703F','#A86A6A','#202020'];
const CS = 'CS / IT', FONT = 'Inter, Helvetica, Arial, sans-serif';
const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize);
const nf = n => Math.round(n).toLocaleString('en-US');
const p1 = v => v.toFixed(1) + '%';
const pp = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + ' pp';
const mil = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M' : nf(n);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const rgba = (h, a) => 'rgba(' + [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16)).join(',') + ',' + a + ')';
const by = k => (a, b) => a[k] - b[k];
const CFG = {displayModeBar: false, responsive: true};

function lay(extra) {
  extra = extra || {};
  const r = rem(), ax = {gridcolor: 'rgba(32,32,32,.12)', zeroline: false, linecolor: P.black, tickfont: {size: r * 0.9}, automargin: true};
  const out = Object.assign({font: {family: FONT, size: r * 0.95, color: P.black}, paper_bgcolor: '#fff', plot_bgcolor: '#fff',
    margin: {l: r * 4, r: r * 11, t: r * 0.6, b: r * 2.4}, showlegend: false,
    hoverlabel: {bgcolor: P.black, bordercolor: P.black, font: {family: FONT, size: r * 0.9, color: '#fff'}}}, extra);
  out.xaxis = Object.assign({}, ax, {showgrid: false, ticks: 'outside', ticklen: r * 0.3, dtick: 1}, extra.xaxis);
  if (extra.span) { out.xaxis.range = [extra.span[0] - 0.5, extra.span[1] + 0.5]; delete out.span; }
  out.yaxis = Object.assign({}, ax, {ticksuffix: '%'}, extra.yaxis);
  return out;
}
function line(rows, xk, name, color, opt) {
  const r = rem();
  return Object.assign({type: 'scatter', mode: 'lines+markers', name, x: rows.map(d => d[xk]), y: rows.map(d => d.junior_pct), customdata: rows.map(d => d.n),
    line: {color, width: r * 0.22}, marker: {color, size: r * 0.5},
    hovertemplate: '<b>' + name + '</b><br>%{x}: %{y:.1f}%<br>n = %{customdata:,}<extra></extra>'}, opt || {});
}
/* labels at the right end of lines, pushed apart so they never overlap */
function endLabels(items, yRange) {
  const r = rem(), gap = (yRange[1] - yRange[0]) * 0.11, s = items.slice().sort((a, b) => b.y - a.y);
  s.forEach((d, i) => { d.ly = i && s[i - 1].ly - d.y < gap ? s[i - 1].ly - gap : d.y; });
  return s.map(d => ({x: d.x, y: d.ly, xref: 'x', yref: 'y', text: d.text, showarrow: false, xanchor: 'left', xshift: r * 0.7, font: {size: r * 0.95, color: d.color}, align: 'left'}));
}
function chips(id, fn) {
  const box = $(id);
  box.querySelectorAll('.chip').forEach(b => b.onclick = () => { box.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); fn(b.dataset.v); });
}
function fitPlot(el) { requestAnimationFrame(() => { if (el && el.data) Plotly.Plots.resize(el); }); }
const padRange = (vals, lo, hi) => { const a = Math.min(...vals), b = Math.max(...vals), d = (b - a) || 1; return [Math.floor(a - d * (lo == null ? .12 : lo)), Math.ceil(b + d * (hi == null ? .1 : hi))]; };
function ordinal(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

/* ------------------------------------------------------------ title */
$('m-int').textContent = mil(D.meta.internships);
(function () {
  const c0 = [255, 127, 72], c1 = [224, 227, 255], cols = 48, rows = 3;
  let h = '', seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const t = Math.min(1, Math.max(0, c / (cols - 1) + (rnd() - .5) * .35)), a = rnd() < .12 ? 0 : 1;
    h += '<i style="background:rgba(' + c0.map((v, k) => Math.round(v + (c1[k] - v) * t)).join(',') + ',' + a + ')"></i>';
  }
  $('mosaic').innerHTML = h;
})();

/* ------------------------------------------------------------ 1: junior share, AI talent vs other graduates */
const S1 = {view: 'share'};
function drawS1() {
  const ai = D.junior_ai.filter(r => r.grp === 'AI talent').sort(by('cal_year')), ot = D.junior_ai.filter(r => r.grp === 'Other graduates').sort(by('cal_year'));
  const a0 = ai[0], a1 = ai[ai.length - 1], o0 = ot[0], o1 = ot[ot.length - 1], y0 = a0.cal_year, y1 = a1.cal_year, el = $('s1-plot'), r = rem();
  if (S1.view === 'share') {
    const rng = padRange(ai.concat(ot).map(d => d.junior_pct));
    $('s1-sub').innerHTML = `Share of employed graduates in a junior position (seniority level 1–2): AI talent <b>${p1(a0.junior_pct)} → ${p1(a1.junior_pct)}</b>, other graduates <b>${p1(o0.junior_pct)} → ${p1(o1.junior_pct)}</b> (${y0} → ${y1}).`;
    Plotly.react(el, [line(ot, 'cal_year', 'Other graduates', P.petrol), line(ai, 'cal_year', 'AI talent', P.orange)],
      lay({span: [y0, y1], yaxis: {range: rng}, annotations: endLabels([{x: y1, y: o1.junior_pct, text: '<b>Other graduates</b><br>' + p1(o1.junior_pct), color: P.petrol},
        {x: y1, y: a1.junior_pct, text: '<b>AI talent</b><br>' + p1(a1.junior_pct), color: P.orange}], rng)}), CFG);
  } else if (S1.view === 'gap') {
    const gap = ai.map((d, i) => ({cal_year: d.cal_year, v: d.junior_pct - ot[i].junior_pct, n: d.n}));
    $('s1-sub').innerHTML = `Junior share of AI talent minus junior share of other graduates: <b>${pp(gap[0].v)}</b> in ${y0}, <b>${pp(gap[gap.length - 1].v)}</b> in ${y1}.`;
    Plotly.react(el, [{type: 'bar', x: gap.map(d => d.cal_year), y: gap.map(d => d.v), marker: {color: P.orange}, customdata: gap.map(d => d.n),
      text: gap.map(d => pp(d.v)), textposition: 'outside', textfont: {size: r * 0.9, color: P.black}, cliponaxis: false,
      hovertemplate: '%{x}: %{y:.1f} pp<br>AI-talent observations = %{customdata:,}<extra></extra>'}],
      lay({span: [y0, y1], margin: {l: r * 5, r: r * 2, t: r * 0.6, b: r * 2.4}, yaxis: {range: [Math.floor(Math.min(...gap.map(d => d.v)) - 2), 0], ticksuffix: ' pp'}, bargap: .35}), CFG);
  } else {
    const all = ai.map((d, i) => ({cal_year: d.cal_year, n: d.n + ot[i].n, junior_pct: (d.junior_pct * d.n + ot[i].junior_pct * ot[i].n) / (d.n + ot[i].n)}));
    const mix = D.junior_mix.map(d => ({cal_year: d.yr, junior_pct: d.junior_pct_mix_2015_19})).sort(by('cal_year'));
    const m = k => mix.find(d => d.cal_year === k).junior_pct, peak = mix.reduce((a, b) => b.junior_pct > a.junior_pct ? b : a), aN = all[all.length - 1];
    const rng = padRange(all.concat(mix).map(d => d.junior_pct));
    $('s1-sub').innerHTML = `Graduates since 2005 get older over the window, which lowers the junior share by itself. Holding the mix of years since graduation at its 2015–19 level, the share is <b>${p1(m(y0))}</b> in ${y0}, peaks at <b>${p1(peak.junior_pct)}</b> in ${peak.cal_year} and is <b>${p1(m(y1))}</b> in ${y1} (${pp(m(y1) - peak.junior_pct)}).`;
    const mt = line(mix, 'cal_year', 'Career stage held fixed', P.blue); mt.hovertemplate = '<b>Career stage held fixed</b><br>%{x}: %{y:.1f}%<extra></extra>';
    Plotly.react(el, [line(all, 'cal_year', 'All graduates, as measured', P.g1), mt],
      lay({span: [y0, y1], yaxis: {range: rng}, annotations: endLabels([{x: y1, y: aN.junior_pct, text: '<b>As measured</b><br>' + p1(aN.junior_pct), color: P.g1},
        {x: y1, y: m(y1), text: '<b>Career stage held fixed</b><br>' + p1(m(y1)), color: P.blue}], rng)}), CFG);
  }
  $('s1-src').textContent = `Revelio Labs, ${D.meta.basis}; graduates of EU31 and US universities since 2005, full population. One observation per person per calendar year employed (${mil(a1.n + o1.n)} in ${y1}; data end ${D.meta.data_end}). AI talent = Revelio AI-talent flag.`;
  fitPlot(el);
}
chips('s1-chips', v => { S1.view = v; drawS1(); });

/* ------------------------------------------------------------ 2: CS vs other fields */
const S2 = {measure: 'stock', view: 'cs'};
function drawS2() {
  const stock = S2.measure === 'stock', xk = stock ? 'cal_year' : 'cohort', el = $('s2-plot'), r = rem();
  const csRows = stock ? D.stock_cs : D.entry_cs, fld = stock ? D.stock_field : D.entry_field;
  const what = stock ? 'Share of employed graduates in a junior position' : 'Share of graduates whose first job is junior';
  const xt = stock ? {} : {dtick: 2, title: {text: 'Graduation year', font: {size: r * 0.9}}};
  if (el.removeAllListeners) { el.removeAllListeners('plotly_hover'); el.removeAllListeners('plotly_unhover'); }
  if (S2.view === 'cs') {
    const c = csRows.filter(d => d.grp === 'CS').sort(by(xk)), n = csRows.filter(d => d.grp === 'non-CS').sort(by(xk));
    const c0 = c[0], c1 = c[c.length - 1], n0 = n[0], n1 = n[n.length - 1], rng = padRange(csRows.map(d => d.junior_pct));
    $('s2-sub').innerHTML = `${what}: CS <b>${p1(c0.junior_pct)} → ${p1(c1.junior_pct)}</b>, all other fields <b>${p1(n0.junior_pct)} → ${p1(n1.junior_pct)}</b> (${c0[xk]} → ${c1[xk]}). CS minus the rest: ${pp(c0.junior_pct - n0.junior_pct)} → ${pp(c1.junior_pct - n1.junior_pct)}.`;
    Plotly.react(el, [line(n, xk, 'All other fields', P.petrol), line(c, xk, 'Computer science / IT', P.orange)],
      lay({span: [c0[xk], c1[xk]], xaxis: xt, yaxis: {range: rng}, annotations: endLabels([{x: n1[xk], y: n1.junior_pct, text: '<b>All other fields</b><br>' + p1(n1.junior_pct), color: P.petrol},
        {x: c1[xk], y: c1.junior_pct, text: '<b>Computer science / IT</b><br>' + p1(c1.junior_pct), color: P.orange}], rng)}), CFG);
  } else {
    const groups = [...new Set(fld.map(d => d.fgroup))].sort((a, b) => (a === CS) - (b === CS) || a.localeCompare(b));
    const last = Math.max(...fld.map(d => d[xk])), val = (g, x) => fld.find(d => d.fgroup === g && d[xk] === x).junior_pct;
    /* change window: the whole series for the employment share; 2019 to 2024 graduates for first jobs (2025 is observed 16 months only) */
    const from = stock ? Math.min(...fld.map(d => d[xk])) : 2019, to = stock ? last : 2024;
    const chg = groups.map(g => ({g, d: val(g, to) - val(g, from)})).sort((a, b) => a.d - b.d);
    const rank = chg.findIndex(d => d.g === CS) + 1, csC = chg[rank - 1], rng = padRange(fld.map(d => d.junior_pct), .06, .06);
    const other = rank === 1 ? `next: ${esc(chg[1].g)} (${pp(chg[1].d)})` : `largest: ${esc(chg[0].g)} (${pp(chg[0].d)})`;
    $('s2-sub').innerHTML = `${what}, 15 degree fields. CS: <b>${pp(csC.d)}</b> from ${from} to ${to}${stock ? '' : ' graduates'}, the ${rank === 1 ? 'largest' : ordinal(rank) + ' largest'} fall of 15; ${other}. Hover a line to name it.`;
    const grey = '#c3c7cd', col = g => g === CS ? P.orange : grey, wid = g => g === CS ? r * 0.3 : r * 0.13;
    const traces = groups.map(g => line(fld.filter(d => d.fgroup === g).sort(by(xk)), xk, g === CS ? 'Computer science / IT' : g, col(g), {mode: 'lines', line: {color: col(g), width: wid(g)}}));
    const top = groups.map(g => ({g, v: val(g, last)})).sort((a, b) => b.v - a.v);
    const labelFor = (g, color) => ({x: last, y: val(g, last), text: (g === CS ? '<b>Computer science / IT</b>' : esc(g)) + '<br>' + p1(val(g, last)), color: color || (g === CS ? P.orange : P.g1)});
    const baseAnn = endLabels([...new Set([CS, top[0].g, top[top.length - 1].g])].map(g => labelFor(g)), rng);
    Plotly.react(el, traces, lay({span: [Math.min(...fld.map(d => d[xk])), last], xaxis: xt, yaxis: {range: rng}, hovermode: 'closest', annotations: baseAnn}), CFG);
    el.on('plotly_hover', ev => { const i = ev.points[0].curveNumber, g = groups[i]; if (g === CS) return;
      Plotly.restyle(el, {'line.color': groups.map((x, j) => j === i ? P.petrol : col(x)), 'line.width': groups.map((x, j) => j === i ? r * 0.26 : wid(x))});
      Plotly.relayout(el, {annotations: endLabels([labelFor(CS), labelFor(g, P.petrol)], rng)}); });
    el.on('plotly_unhover', () => { Plotly.restyle(el, {'line.color': groups.map(col), 'line.width': groups.map(wid)}); Plotly.relayout(el, {annotations: baseAnn}); });
  }
  $('s2-src').textContent = `Revelio Labs, ${D.meta.basis}; graduates of EU31 and US universities since 2005. Field = top degree, assigned by a multilingual sentence-embedding classifier (15 groups, no keyword matching)` +
    (stock ? `; ${D.meta.unclassified_pct}% of observations have no classified field and are left out. One observation per person per calendar year employed.`
           : '. First job = lowest level held from 6 months before to 24 months after graduation; the 2025 cohort is observed for about 16 months only.');
  fitPlot(el);
}
chips('s2-measure', v => { S2.measure = v; drawS2(); });
chips('s2-view', v => { S2.view = v; drawS2(); });

/* ------------------------------------------------------------ 3: internships */
const F = D.flows, S3 = {where: 'r:EU31', period: [2015, 2023], third: 'later'};
const REG = {'r:EU31': {label: 'Europe (EU31)', set: new Set(F.eu31)}, 'r:EU27': {label: 'EU-27', set: new Set(F.eu27)},
  'r:US': {label: 'United States', set: new Set(['United States'])}, 'r:ALL': {label: 'All countries', set: null}};
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
const OC = {'junior job (level 1-2)': P.petrol, 'associate or above (level 3+)': P.blue, 'another internship': P.steel, 'back to study': P.mocha, 'no position observed': P.g1,
  'reached associate (3+) within 2 years': '#9EA9FF', 'still junior after 2 years': '#7FA3AB', 'same company': P.orange, 'different company': P.brown, 'company unknown': P.g3};
const NICE = {'junior job (level 1-2)': 'Junior job', 'associate or above (level 3+)': 'Associate level or above', 'another internship': 'Another internship', 'back to study': 'Back to study',
  'no position observed': 'No position observed', 'reached associate (3+) within 2 years': 'Associate level within 2 years', 'still junior after 2 years': 'Still junior after 2 years',
  'same company': 'Same employer', 'different company': 'Different employer', 'company unknown': 'Employer unknown'};
function drawS3() {
  const t = tally(S3.where, S3.period), base = S3.where === 'r:EU31' ? null : tally('r:EU31', S3.period), r = rem();
  const third = S3.third === 'later' ? F.s3 : F.co, names = ['internship', ...F.s2, ...third];
  const ix = n => names.indexOf(n), src = [], tgt = [], val = [], cd = [], lc = [], tot = names.map(() => 0);
  const add = (a, b, n, of, ofLabel) => { if (n <= 0) return; src.push(ix(a)); tgt.push(ix(b)); val.push(n); lc.push(rgba(OC[b], .42));
    cd.push(`${(100 * n / t.n).toFixed(1)}% of internships` + (of ? `<br>${(100 * n / of).toFixed(1)}% of ${ofLabel}` : '')); tot[ix(b)] += n; };
  F.s2.forEach((s, i) => add('internship', s, t.s2[i]));
  if (S3.third === 'later') F.s3.forEach((s, k) => add(F.s2[0], s, t.s3[k], t.s2[0], 'junior hires'));
  else [0, 1].forEach(i => F.co.forEach((c, o) => add(F.s2[i], c, t.co[i][o], t.s2[i], i ? 'associate-level hires' : 'junior hires')));
  tot[0] = t.n;
  const lab = names.map((n, i) => i === 0 ? 'Internship' : tot[i] / t.n > 0.004 ? `${NICE[n]} · ${(100 * tot[i] / t.n).toFixed(1)}%` : '');
  Plotly.react($('s3-plot'), [{type: 'sankey', orientation: 'h', arrangement: 'snap',
    node: {pad: r * 1.5, thickness: r * 1.1, line: {width: 0}, label: lab, color: names.map(n => OC[n] || P.black),
      customdata: names.map((n, i) => (i ? NICE[n] : 'Internship') + '<br>' + (100 * tot[i] / t.n).toFixed(1) + '% of internships'),
      hovertemplate: '<b>%{customdata}</b><br>n = %{value:,}<extra></extra>'},
    link: {source: src, target: tgt, value: val, customdata: cd, color: lc,
      hovertemplate: 'n = %{value:,}<br>%{customdata}<extra></extra>'},
    textfont: {family: FONT, size: r * 0.95, color: P.black}}],
    {font: {family: FONT, size: r * 0.95, color: P.black}, paper_bgcolor: '#fff', margin: {l: r * 0.5, r: r * 0.5, t: r * 0.8, b: r * 0.8},
      hoverlabel: {bgcolor: P.black, bordercolor: P.black, font: {family: FONT, size: r * 0.9, color: '#fff'}}}, CFG);
  const per = S3.period[0] + '–' + String(S3.period[1]).slice(2), cmp = v => base ? `Europe (EU31): ${v}` : '';
  $('k-n').textContent = mil(t.n); $('k-n-c').textContent = `${whereLabel(S3.where)}, started ${per}`;
  $('k-job').textContent = p1(t.job); $('k-job-c').textContent = cmp(base && p1(base.job));
  $('k-same').textContent = p1(t.same); $('k-same-c').textContent = cmp(base && p1(base.same));
  $('k-up').textContent = p1(t.up); $('k-up-c').textContent = cmp(base && p1(base.up));
  $('s3-sub').innerHTML = `${esc(whereLabel(S3.where))}, internships started ${per}: <b>${p1(100 * t.s2[0] / t.n)}</b> lead to a junior job and <b>${p1(100 * t.s2[1] / t.n)}</b> to a job at associate level or above within 12 months; for <b>${p1(100 * t.s2[4] / t.n)}</b> no next position appears.`;
  $('s3-src').textContent = `Revelio Labs, ${D.meta.basis}. Each person's first internship (started 2015 or later, ended at least three years before ${D.meta.data_end}); first outcome within 12 months of its end; junior hires followed two more years. Country = country of the internship. "No position observed" can mean unemployment, work not on the profile, or a profile that was not updated.`;
  fitPlot($('s3-plot'));
}
chips('s3-period', v => { S3.period = v.split('-').map(Number); drawS3(); });
chips('s3-third', v => { S3.third = v; drawS3(); });

/* ------------------------------------------------------------ 4: map of degree fields (canvas hexbin of the UMAP layout) */
let mapResize = null;
function initMap() {
  const FM = D.field_map, S = FM.hex_size, OX = FM.origin[0], OY = FM.origin[1], H = FM.hexes, SQ = Math.sqrt(3);
  H.forEach(h => { h.x = OX + S * SQ * (h.q + h.r / 2); h.y = OY + S * 1.5 * h.r; });
  const index = new Map(); H.forEach((h, i) => index.set(h.q + ',' + h.r, i));
  const groups = [...new Set(H.map(h => h.group))].sort(), GC = {}; groups.forEach((g, i) => GC[g] = PAL15[i % 15]);
  { const o = groups.find(g => GC[g] === P.orange); if (o && o !== CS) { GC[o] = GC[CS]; GC[CS] = P.orange; } }
  const h2r = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
  const ramp = stops => { const c = stops.map(h2r); return t => { t = Math.max(0, Math.min(1, t)); const x = t * (c.length - 1), i = Math.min(c.length - 2, Math.floor(x)), f = x - i;
    return 'rgb(' + [0, 1, 2].map(k => Math.round(c[i][k] + (c[i + 1][k] - c[i][k]) * f)).join(',') + ')'; }; };
  const quant = (a, p) => { a = a.filter(v => v != null).sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * (a.length - 1)))]; };
  const both = H.flatMap(h => [h.j_pre, h.j_post]), jd = [quant(both, .02), quant(both, .98)];
  const chg = h => h.j_pre == null || h.j_post == null ? null : h.j_post - h.j_pre, cm = quant(H.map(chg).map(v => v == null ? null : Math.abs(v)), .98);
  const aid = [0, quant(H.map(h => h.ai), .98)];
  const SEQ = ramp([P.ecru, P.orange, P.brown]), DIV = ramp([P.petrol, '#f2f3f5', P.orange]), AI = ramp([P.lav, P.blue, P.petrol]);
  const num = (v, d) => v.toFixed(d);
  const MODES = {field: {pill: 'Degree field'},
    pre: {pill: 'Junior first job, 2015–19 graduates', get: h => h.j_pre, col: v => SEQ((v - jd[0]) / (jd[1] - jd[0])), dom: jd, ramp: SEQ, fmt: v => num(v, 0) + '%'},
    post: {pill: 'Junior first job, 2023–24 graduates', get: h => h.j_post, col: v => SEQ((v - jd[0]) / (jd[1] - jd[0])), dom: jd, ramp: SEQ, fmt: v => num(v, 0) + '%'},
    chg: {pill: 'Change between the two', get: chg, col: v => DIV((v + cm) / (2 * cm)), dom: [-cm, cm], ramp: DIV, fmt: v => (v > 0 ? '+' : '') + num(v, 0) + ' pp'},
    ai: {pill: 'AI talent share', get: h => h.ai, col: v => AI((v - aid[0]) / (aid[1] - aid[0])), dom: aid, ramp: AI, fmt: v => num(v, 0) + '%'}};
  let mode = 'field', cols = [], focus = null, marker = null, touched = false;
  const cv = $('map'), ctx = cv.getContext('2d'), tip = $('tip');
  let W = 0, HT = 0, dpr = 1, k = 1, tx = 0, ty = 0, fitK = 1;
  const minX = Math.min(...H.map(h => h.x)) - S, maxX = Math.max(...H.map(h => h.x)) + S, minY = Math.min(...H.map(h => h.y)) - S, maxY = Math.max(...H.map(h => h.y)) + S;
  const VX = [0, 1, 2, 3, 4, 5].map(i => Math.cos(Math.PI / 180 * (60 * i - 30))), VY = [0, 1, 2, 3, 4, 5].map(i => Math.sin(Math.PI / 180 * (60 * i - 30)));
  function fit() { fitK = Math.min(W / (maxX - minX), HT / (maxY - minY)) * .96; k = fitK; tx = W / 2 - (minX + maxX) / 2 * k; ty = HT / 2 - (minY + maxY) / 2 * k; }
  function paint() { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, HT); const R = S * k * 1.03; let al = 1;
    for (let i = 0; i < H.length; i++) { const h = H[i], sx = h.x * k + tx, sy = h.y * k + ty; if (sx < -R || sy < -R || sx > W + R || sy > HT + R) continue;
      const a = focus && h.group !== focus ? .12 : 1; if (a !== al) { ctx.globalAlpha = al = a; }
      ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(sx + VX[0] * R, sy + VY[0] * R); for (let j = 1; j < 6; j++) ctx.lineTo(sx + VX[j] * R, sy + VY[j] * R); ctx.closePath(); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (marker) { const sx = marker.x * k + tx, sy = marker.y * k + ty, r = rem(); ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, sy, r * .8, 0, 7); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = P.black; ctx.beginPath(); ctx.arc(sx, sy, r * .8, 0, 7); ctx.stroke();
      ctx.font = '500 ' + r * .95 + 'px Inter, sans-serif'; const w = ctx.measureText(marker.label).width, lx = Math.min(Math.max(sx - w / 2, r), W - w - r);
      ctx.fillStyle = P.black; ctx.fillRect(lx - r * .4, sy - r * 2.9, w + r * .8, r * 1.6); ctx.fillStyle = '#fff'; ctx.fillText(marker.label, lx, sy - r * 1.8); } }
  function colour() { cols = H.map(h => { if (mode === 'field') return GC[h.group]; const m = MODES[mode], v = m.get(h); return v == null ? P.g3 : m.col(v); }); paint(); legend(); }
  function legend() { const el = $('maplegend'); el.innerHTML = '';
    if (mode === 'field') { el.className = 'legend'; groups.forEach(g => { const c = document.createElement('span'); c.className = 'lchip' + (focus && focus !== g ? ' dim' : '');
      c.innerHTML = `<i style="background:${GC[g]}"></i>${esc(g)}`; c.onclick = () => { focus = focus === g ? null : g; legend(); paint(); }; el.appendChild(c); }); return; }
    el.className = 'scale'; const m = MODES[mode]; let sw = '';
    for (let i = 0; i < 24; i++) sw += `<i style="background:${m.ramp(i / 23)}"></i>`;
    el.innerHTML = `<div class="sw">${sw}</div><div class="ends"><span>${m.fmt(m.dom[0])}</span><span>${m.fmt(m.dom[1])}</span></div>` +
      `<div class="nt">${mode === 'chg' ? 'Petrol: junior share lower for 2023–24 graduates; orange: higher. ' : ''}Grey: fewer than 30 graduates. Colour scale clipped at the ${mode === 'chg' || mode === 'ai' ? '98th percentile' : '2nd and 98th percentiles'}.` +
      (focus ? ` Showing ${esc(focus)} only (pick “Degree field” to change).` : '') + '</div>'; }
  function resize() { const r = cv.getBoundingClientRect(); if (r.width < 10 || r.height < 10) return; dpr = window.devicePixelRatio || 1; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); W = r.width; HT = r.height; if (!touched) fit(); paint(); }
  function zoomAt(px, py, f) { const nk = Math.max(fitK * .8, Math.min(fitK * 80, k * f)), r = nk / k; tx = px - (px - tx) * r; ty = py - (py - ty) * r; k = nk; touched = true; paint(); }
  function animate(k2, tx2, ty2) { const k0 = k, x0 = tx, y0 = ty, t0 = performance.now(); touched = true;
    (function step(now) { const t = Math.min(1, (now - t0) / 450), e = 1 - Math.pow(1 - t, 3); k = k0 + (k2 - k0) * e; tx = x0 + (tx2 - x0) * e; ty = y0 + (ty2 - y0) * e; paint(); if (t < 1) requestAnimationFrame(step); })(t0); }
  function hit(px, py) { const x = ((px - tx) / k - OX) / S, y = ((py - ty) / k - OY) / S, q = SQ / 3 * x - y / 3, r = 2 / 3 * y, cx = q, cz = r, cy = -q - r; let rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
    const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz); if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
    const i = index.get(rx + ',' + rz); return i == null ? -1 : i; }
  function showTip(i, px, py) { if (i < 0) { tip.style.display = 'none'; return; } const h = H[i], row = (l, v, f) => `<div><span class="tf">${l}</span> ${v == null ? 'n/a (fewer than 30 graduates)' : f(v)}</div>`;
    const c = chg(h); tip.innerHTML = `<b>${esc(h.group)}</b><div style="margin:.3rem 0">${h.top.map(esc).join('<br>')}</div><div class="tf">${nf(h.fields)} degree names · ${nf(h.n26)} graduates</div>` +
      row('Junior first job, 2015–19', h.j_pre, v => num(v, 1) + '%') + row('Junior first job, 2023–24', h.j_post, v => num(v, 1) + '%') + row('Change', c, v => (v > 0 ? '+' : '') + num(v, 1) + ' pp') + row('AI talent share', h.ai, v => num(v, 1) + '%');
    tip.style.display = 'block'; const w = tip.offsetWidth, hh = tip.offsetHeight; tip.style.left = Math.max(4, Math.min(W - w - 4, px + 14)) + 'px'; tip.style.top = Math.max(4, Math.min(HT - hh - 4, py + 14)) + 'px'; }
  let drag = null, moved = 0;
  const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); drag = pos(e); moved = 0; cv.classList.add('drag'); });
  cv.addEventListener('pointermove', e => { const p = pos(e); if (!drag) { showTip(hit(p[0], p[1]), p[0], p[1]); return; }
    const dx = p[0] - drag[0], dy = p[1] - drag[1]; drag = p; moved += Math.abs(dx) + Math.abs(dy); if (moved > 5) { tx += dx; ty += dy; touched = true; tip.style.display = 'none'; paint(); } });
  const up = () => { drag = null; cv.classList.remove('drag'); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', () => { if (!drag) tip.style.display = 'none'; });
  cv.addEventListener('wheel', e => { e.preventDefault(); const p = pos(e); zoomAt(p[0], p[1], Math.exp(-e.deltaY * .0015)); }, {passive: false});
  $('zin').onclick = () => zoomAt(W / 2, HT / 2, 1.6); $('zout').onclick = () => zoomAt(W / 2, HT / 2, 1 / 1.6);
  $('zreset').onclick = () => { touched = false; marker = null; fit(); paint(); };
  const pills = $('s4-modes');
  Object.entries(MODES).forEach(([key, m], i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (i ? '' : ' on'); b.textContent = m.pill;
    b.onclick = () => { mode = key; [...pills.children].forEach(x => x.classList.toggle('on', x === b)); colour(); }; pills.appendChild(b); });
  const SL = FM.search.map(r => r.f.toLowerCase()), inp = $('q'), sug = $('sug'); let sel = -1, cur = [];
  function suggest() { const v = inp.value.trim().toLowerCase(); sug.innerHTML = ''; sel = -1; cur = []; if (!v) { sug.style.display = 'none'; marker = null; paint(); return; }
    const pre = [], sub = []; for (let i = 0; i < SL.length && pre.length < 8; i++) { const j = SL[i].indexOf(v); if (j === 0) pre.push(i); else if (j > 0 && sub.length < 8) sub.push(i); }
    cur = [...pre, ...sub].slice(0, 8); cur.forEach(i => { const li = document.createElement('li'), r = FM.search[i]; li.innerHTML = esc(r.f) + '<small>' + esc(r.g) + '</small>'; li.onmousedown = ev => { ev.preventDefault(); choose(i); }; sug.appendChild(li); });
    sug.style.display = cur.length ? 'block' : 'none'; }
  function choose(i) { const r = FM.search[i]; inp.value = r.f; sug.style.display = 'none'; marker = {x: r.x, y: r.y, label: r.f}; const k2 = fitK * 7; animate(k2, W / 2 - r.x * k2, HT / 2 - r.y * k2); }
  inp.addEventListener('input', suggest); inp.addEventListener('blur', () => { sug.style.display = 'none'; });
  inp.addEventListener('keydown', e => { e.stopPropagation(); const li = [...sug.children];
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && li.length) { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + li.length) % li.length; li.forEach((x, i) => x.classList.toggle('hi', i === sel)); }
    else if (e.key === 'Enter' && cur.length) { e.preventDefault(); choose(cur[Math.max(sel, 0)]); } else if (e.key === 'Escape') { sug.style.display = 'none'; inp.blur(); } });
  const tot = H.reduce((a, h) => a + h.n26, 0);
  $('s4-sub').innerHTML = `<b>${nf(FM.n_fields)}</b> distinct degree names as graduates wrote them, in any language, placed by meaning: names that mean similar things sit close together. Each hexagon groups nearby names (${mil(tot)} graduates in total). Hover, zoom, or search.`;
  $('s4-src').textContent = `Revelio Labs, ${D.meta.basis}. Multilingual sentence embeddings (paraphrase-multilingual-MiniLM-L12-v2, 384 dimensions) of each degree name, projected to two dimensions with UMAP; the same embeddings feed the 15-field classifier used on the previous slides. Junior first job = lowest level held from 6 months before to 24 months after graduation.`;
  mapResize = resize; new ResizeObserver(resize).observe(cv); resize(); colour();
}

/* ------------------------------------------------------------ reveal wiring */
const DRAW = {s1: drawS1, s2: drawS2, s3: drawS3, s4: () => { if (mapResize) mapResize(); else initMap(); }};
function show(slide) { const k = slide && slide.dataset.chart; if (k) requestAnimationFrame(() => DRAW[k]()); }
Reveal.initialize({disableLayout: true, display: 'flex', controls: true, controlsLayout: 'bottom-right', progress: true, hash: true, slideNumber: 'c/t',
  transition: 'fade', transitionSpeed: 'fast', touch: false, overview: false, center: false, help: false})
  .then(() => { show(Reveal.getCurrentSlide()); Reveal.on('slidechanged', e => show(e.currentSlide)); });
let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => show(Reveal.getCurrentSlide()), 150); });
window.__deck = {tally, S1, S2, S3};
})();
