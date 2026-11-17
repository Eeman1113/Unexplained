/* Unexplained visualiser
   No dependencies. Charts are inline SVG built against CSS custom properties,
   so light/dark are two selected palettes rather than one auto-flipped. */
(function () {
  'use strict';

  var CSV_URL = 'unexplained_phenomena.csv';

  /* Tier order runs most-unexplained -> resolved. This is the editorial spine
     of the dataset, so every chart and sort reuses this one array. */
  var TIERS = [
    { key: 'OPEN_HARD_PROBLEM',    label: 'Open hard problem',   blurb: 'May resist explanation in principle' },
    { key: 'OPEN_TECHNICAL',       label: 'Open technical',      blurb: 'Unsolved, solvable in principle' },
    { key: 'PARTIALLY_EXPLAINED',  label: 'Partly explained',    blurb: 'Mechanism partly known, real gaps remain' },
    { key: 'DISPUTED',             label: 'Disputed',            blurb: 'The anomaly itself is contested' },
    { key: 'ANECDOTAL_UNVERIFIED', label: 'Anecdotal',           blurb: 'No verified phenomenon to explain' },
    { key: 'LIKELY_MUNDANE',       label: 'Likely mundane',      blurb: 'Famous mystery, ordinary answer' },
    { key: 'PSEUDO_RESOLVED',      label: 'Solved, still told',  blurb: 'Resolved, still circulates as a mystery' }
  ];
  /* Three groups -> three categorical slots, which is what clears the
     all-pairs CVD gate. Seven hues would not. */
  var GROUPS = [
    { key: 'open',      label: 'Open',                 slot: 1, tiers: ['OPEN_HARD_PROBLEM', 'OPEN_TECHNICAL'] },
    { key: 'partial',   label: 'Partly explained',     slot: 2, tiers: ['PARTIALLY_EXPLAINED'] },
    { key: 'contested', label: 'Contested or deflated', slot: 3, tiers: ['DISPUTED', 'ANECDOTAL_UNVERIFIED', 'LIKELY_MUNDANE', 'PSEUDO_RESOLVED'] }
  ];
  var EVID  = ['ROBUST', 'MODERATE', 'WEAK', 'NONE'];
  var REPRO = ['YES', 'PARTIAL', 'NO', 'ONE_OFF', 'NA'];
  var REPRO_LABEL = { YES: 'Reproducible', PARTIAL: 'Partly', NO: 'Not reproducible', ONE_OFF: 'One-off event', NA: 'Not applicable' };

  var groupOf = {};
  GROUPS.forEach(function (g) { g.tiers.forEach(function (t) { groupOf[t] = g; }); });
  var tierIndex = {};
  TIERS.forEach(function (t, i) { tierIndex[t.key] = i; });

  var ALL = [], view = [], shown = 0, PAGE = 50;
  var state = { q: '', cat: '', evid: '', repro: '', diff: '', tiers: {}, sort: 'id' };

  var $  = function (s) { return document.querySelector(s); };
  var el = function (t, c, txt) {
    var n = document.createElement(t);
    if (c) n.className = c;
    if (txt != null) n.textContent = txt;
    return n;
  };
  var esc = function (s) { return String(s == null ? '' : s); };
  var cssVar = function (n) {
    return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  };

  /* ---------- RFC 4180 CSV parser (quoted fields, embedded commas) ---------- */
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    var rows = [], row = [], val = '', i = 0, q = false, n = text.length;
    while (i < n) {
      var c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { val += '"'; i += 2; continue; }
          q = false; i++; continue;
        }
        val += c; i++; continue;
      }
      if (c === '"') { q = true; i++; continue; }
      if (c === ',') { row.push(val); val = ''; i++; continue; }
      if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(val); rows.push(row); row = []; val = ''; i++; continue;
      }
      val += c; i++;
    }
    if (val !== '' || row.length) { row.push(val); rows.push(row); }
    return rows;
  }

  /* ---------- tooltip ---------- */
  var tip = $('#tip');
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.setAttribute('data-show', '1');
    var r = tip.getBoundingClientRect();
    var left = Math.min(Math.max(8, x - r.width / 2), window.innerWidth - r.width - 8);
    var top = y - r.height - 12;
    if (top < 8) top = y + 18;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }
  function hideTip() { tip.setAttribute('data-show', '0'); }
  document.addEventListener('scroll', hideTip, { passive: true });

  function bindTip(node, html) {
    function at(e) {
      var r = node.getBoundingClientRect();
      var cx = e && e.clientX ? e.clientX : r.left + r.width / 2;
      showTip(html, cx, r.top);
    }
    node.addEventListener('mouseenter', at);
    node.addEventListener('mousemove', at);
    node.addEventListener('mouseleave', hideTip);
    node.addEventListener('focus', function () {
      var r = node.getBoundingClientRect();
      showTip(html, r.left + r.width / 2, r.top);
    });
    node.addEventListener('blur', hideTip);
  }

  /* ---------- SVG helpers ---------- */
  var NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    return n;
  }
  /* 4px rounded data-end, square against the baseline. */
  function barPathH(x, y, w, h, r) {
    r = Math.min(r, w, h / 2);
    if (w <= 0.5) return 'M' + x + ' ' + y + 'h0.5v' + h + 'h-0.5z';
    return 'M' + x + ' ' + y + 'h' + (w - r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r +
           'v' + (h - 2 * r) + 'a' + r + ' ' + r + ' 0 0 1 ' + (-r) + ' ' + r + 'h' + (-(w - r)) + 'z';
  }
  function barPathV(x, y, w, h, r) {
    r = Math.min(r, h, w / 2);
    if (h <= 0.5) return 'M' + x + ' ' + y + 'h' + w + 'v0.5h' + (-w) + 'z';
    return 'M' + x + ' ' + (y + r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + (-r) +
           'h' + (w - 2 * r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r +
           'v' + (h - r) + 'h' + (-w) + 'z';
  }
  function niceMax(v) {
    if (v <= 5) return 5;
    var mag = Math.pow(10, Math.floor(Math.log10(v)));
    var steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 4.5, 5, 6, 8, 10];
    for (var i = 0; i < steps.length; i++) {
      if (v <= steps[i] * mag) return steps[i] * mag;
    }
    return 10 * mag;
  }

  /* ---------- filtering ---------- */
  function anyTier() { return TIERS.some(function (t) { return state.tiers[t.key]; }); }

  function applyFilters() {
    var q = state.q.toLowerCase().trim();
    var terms = q ? q.split(/\s+/) : [];
    var useTier = anyTier();
    view = ALL.filter(function (d) {
      if (useTier && !state.tiers[d.status_code]) return false;
      if (state.cat && d.category !== state.cat) return false;
      if (state.evid && d.evidence_strength !== state.evid) return false;
      if (state.repro && d.reproducible !== state.repro) return false;
      if (state.diff && d.diffNum < +state.diff) return false;
      for (var i = 0; i < terms.length; i++) {
        if (d.hay.indexOf(terms[i]) === -1) return false;
      }
      return true;
    });
    sortView();
    render();
  }

  function sortView() {
    var k = state.sort;
    view.sort(function (a, b) {
      if (k === 'id') return a.idNum - b.idNum;
      if (k === 'diff') return b.diffNum - a.diffNum || a.idNum - b.idNum;
      if (k === 'tier') return tierIndex[a.status_code] - tierIndex[b.status_code] || b.diffNum - a.diffNum;
      if (k === 'az') return a.phenomenon.localeCompare(b.phenomenon);
      return 0;
    });
  }

  /* ---------- tiles ---------- */
  function renderTiles() {
    var box = $('#tiles');
    box.innerHTML = '';
    var hard = view.filter(function (d) { return d.status_code === 'OPEN_HARD_PROBLEM'; }).length;
    var core = view.filter(function (d) {
      return d.evidence_strength === 'ROBUST' && d.reproducible === 'YES' &&
             (d.status_code === 'OPEN_HARD_PROBLEM' || d.status_code === 'OPEN_TECHNICAL');
    }).length;
    var fields = {};
    view.forEach(function (d) { fields[d.category] = 1; });
    var tiles = [
      { v: view.length, l: 'Phenomena in view', s: view.length === ALL.length ? 'the whole dataset' : 'of 1000 total' },
      { v: hard, l: 'Open hard problems', s: 'may resist explanation in principle' },
      { v: core, l: 'The hard core', s: 'robust evidence, reproducible, still open' },
      { v: Object.keys(fields).length, l: 'Fields represented', s: 'physics to epigraphy' }
    ];
    tiles.forEach(function (t) {
      var c = el('div', 'tile');
      c.appendChild(el('div', 'tile-value', String(t.v)));
      var lab = el('div', 'tile-label', t.l);
      lab.appendChild(el('div', 'tile-sub', t.s));
      c.appendChild(lab);
      box.appendChild(c);
    });
  }

  /* ---------- chart 1: tiers (single series, order by axis position) ---------- */
  function renderTierChart() {
    var svg = $('#chart-tier');
    while (svg.childNodes.length > 1) svg.removeChild(svg.lastChild);

    var narrow = window.innerWidth < 620;
    var data = TIERS.map(function (t) {
      return { t: t, n: view.filter(function (d) { return d.status_code === t.key; }).length };
    });
    var labelW = narrow ? 112 : 158;
    var padR = 54, rowH = narrow ? 34 : 38, top = 8, axisH = 22;
    var W = svg.clientWidth || 640;
    var H = top + data.length * rowH + axisH;
    var plotW = Math.max(60, W - labelW - padR);
    var max = niceMax(Math.max.apply(null, data.map(function (d) { return d.n; })) || 1);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('height', H);

    var g = s('g');
    /* gridlines + ticks */
    [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
      var x = labelW + plotW * f;
      g.appendChild(s('line', { x1: x, y1: top, x2: x, y2: top + data.length * rowH, class: f === 0 ? 'axisline' : 'gridline' }));
      var tx = s('text', { x: x, y: H - 7, class: 'tick-label num', 'text-anchor': f === 1 ? 'end' : 'middle' });
      tx.textContent = Math.round(max * f);
      g.appendChild(tx);
    });

    data.forEach(function (d, i) {
      var y = top + i * rowH, bh = Math.min(18, rowH - 14);
      var by = y + (rowH - bh) / 2;
      var w = (d.n / max) * plotW;

      var lab = s('text', { x: labelW - 10, y: by + bh / 2 + 4, class: 'cat-label', 'text-anchor': 'end' });
      lab.textContent = narrow ? d.t.label.replace(' problem', '') : d.t.label;
      g.appendChild(lab);

      /* hit target spans the full row and clears 24px */
      var hit = s('rect', { x: labelW, y: y, width: plotW + padR, height: rowH, class: 'hit', tabindex: '0',
        role: 'img', 'aria-label': d.t.label + ': ' + d.n + ' phenomena. ' + d.t.blurb });
      g.appendChild(hit);
      g.appendChild(s('path', { d: barPathH(labelW, by, w, bh, 4), class: 'bar' }));

      var vl = s('text', { x: labelW + w + 8, y: by + bh / 2 + 4, class: 'val-label' });
      vl.textContent = d.n;
      g.appendChild(vl);

      bindTip(hit, '<b>' + d.t.label + '</b><br>' + d.t.blurb +
        '<br><span class="tip-num">' + d.n + '</span> phenomena');
    });
    svg.appendChild(g);
  }

  /* ---------- chart 2: fields, stacked by 3 tier groups ---------- */
  function renderFieldChart() {
    var svg = $('#chart-field');
    while (svg.childNodes.length > 1) svg.removeChild(svg.lastChild);

    var counts = {};
    view.forEach(function (d) {
      if (!counts[d.category]) counts[d.category] = { n: 0, open: 0, partial: 0, contested: 0 };
      counts[d.category].n++;
      counts[d.category][groupOf[d.status_code].key]++;
    });
    var rows = Object.keys(counts).map(function (k) {
      return { name: k, c: counts[k] };
    }).sort(function (a, b) { return b.c.n - a.c.n; });

    var TOP = 9;
    var tail = rows.slice(TOP);
    rows = rows.slice(0, TOP);
    if (tail.length) {
      var o = { n: 0, open: 0, partial: 0, contested: 0 };
      tail.forEach(function (r) {
        o.n += r.c.n; o.open += r.c.open; o.partial += r.c.partial; o.contested += r.c.contested;
      });
      rows.push({ name: tail.length + ' other fields', c: o, isOther: true });
    }

    var narrow = window.innerWidth < 620;
    var labelW = narrow ? 104 : 136, padR = 46, rowH = 30, top = 6, axisH = 22;
    var W = svg.clientWidth || 440;
    var H = top + rows.length * rowH + axisH;
    var plotW = Math.max(50, W - labelW - padR);
    var max = niceMax(Math.max.apply(null, rows.map(function (r) { return r.c.n; })) || 1);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('height', H);

    var g = s('g');
    [0, 0.5, 1].forEach(function (f) {
      var x = labelW + plotW * f;
      g.appendChild(s('line', { x1: x, y1: top, x2: x, y2: top + rows.length * rowH, class: f === 0 ? 'axisline' : 'gridline' }));
      var tx = s('text', { x: x, y: H - 7, class: 'tick-label num', 'text-anchor': f === 1 ? 'end' : 'middle' });
      tx.textContent = Math.round(max * f);
      g.appendChild(tx);
    });

    rows.forEach(function (r, i) {
      var y = top + i * rowH, bh = 15, by = y + (rowH - bh) / 2, x = labelW;

      var nm = r.name.length > (narrow ? 13 : 17) ? r.name.slice(0, narrow ? 12 : 16) + '…' : r.name;
      var lab = s('text', { x: labelW - 9, y: by + bh / 2 + 4, class: 'cat-label', 'text-anchor': 'end' });
      lab.textContent = nm;
      g.appendChild(lab);

      var hit = s('rect', { x: labelW, y: y, width: plotW + padR, height: rowH, class: 'hit', tabindex: '0',
        role: 'img', 'aria-label': r.name + ': ' + r.c.n + ' total, ' + r.c.open + ' open, ' +
          r.c.partial + ' partly explained, ' + r.c.contested + ' contested or deflated' });
      g.appendChild(hit);

      GROUPS.forEach(function (grp, gi) {
        var v = r.c[grp.key];
        if (!v) return;
        var w = (v / max) * plotW;
        /* 2px surface gap between segments, no borders */
        var seg = Math.max(0.5, w - (gi < 2 ? 2 : 0));
        var last = !GROUPS.slice(gi + 1).some(function (gg) { return r.c[gg.key] > 0; });
        g.appendChild(s('path', {
          d: last ? barPathH(x, by, seg, bh, 4) : 'M' + x + ' ' + by + 'h' + seg + 'v' + bh + 'h' + (-seg) + 'z',
          class: grp.slot === 1 ? 'bar' : 'bar s' + grp.slot
        }));
        x += w;
      });

      var vl = s('text', { x: labelW + (r.c.n / max) * plotW + 8, y: by + bh / 2 + 4, class: 'val-label' });
      vl.textContent = r.c.n;
      g.appendChild(vl);

      bindTip(hit, '<b>' + r.name + '</b><br><span class="tip-num">' + r.c.n + '</span> entries' +
        '<br>Open <span class="tip-num">' + r.c.open + '</span> &middot; Partly <span class="tip-num">' +
        r.c.partial + '</span> &middot; Contested <span class="tip-num">' + r.c.contested + '</span>');
    });
    svg.appendChild(g);

    var lg = $('#legend-field');
    lg.innerHTML = '';
    GROUPS.forEach(function (grp) {
      var it = el('span', 'legend-item');
      var sw = el('span', 'swatch');
      sw.style.background = cssVar('--series-' + grp.slot);
      it.appendChild(sw);
      it.appendChild(document.createTextNode(grp.label));
      lg.appendChild(it);
    });
  }

  /* ---------- chart 3: difficulty histogram ---------- */
  function renderDiffChart() {
    var svg = $('#chart-diff');
    while (svg.childNodes.length > 1) svg.removeChild(svg.lastChild);

    var bins = [];
    for (var d = 1; d <= 10; d++) {
      bins.push({ d: d, n: view.filter(function (r) { return r.diffNum === d; }).length });
    }
    var W = svg.clientWidth || 440;
    var padL = 30, padR = 6, top = 14, axisH = 30, plotH = 150;
    var H = top + plotH + axisH;
    var plotW = Math.max(60, W - padL - padR);
    var max = niceMax(Math.max.apply(null, bins.map(function (b) { return b.n; })) || 1);
    var bw = plotW / bins.length;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('height', H);

    var g = s('g');
    [0, 0.5, 1].forEach(function (f) {
      var y = top + plotH - plotH * f;
      g.appendChild(s('line', { x1: padL, y1: y, x2: padL + plotW, y2: y, class: f === 0 ? 'axisline' : 'gridline' }));
      var tx = s('text', { x: padL - 7, y: y + 4, class: 'tick-label num', 'text-anchor': 'end' });
      tx.textContent = Math.round(max * f);
      g.appendChild(tx);
    });

    bins.forEach(function (b, i) {
      var h = (b.n / max) * plotH;
      var x = padL + i * bw + 1;         /* 2px surface gap between adjacent bars */
      var w = bw - 2;
      var y = top + plotH - h;

      var hit = s('rect', { x: padL + i * bw, y: top, width: bw, height: plotH + 16, class: 'hit', tabindex: '0',
        role: 'img', 'aria-label': 'Difficulty ' + b.d + ' of 10: ' + b.n + ' phenomena' });
      g.appendChild(hit);
      g.appendChild(s('path', { d: barPathV(x, y, w, h, 4), class: 'bar' }));

      var tx = s('text', { x: padL + i * bw + bw / 2, y: H - 12, class: 'tick-label num', 'text-anchor': 'middle' });
      tx.textContent = b.d;
      g.appendChild(tx);

      bindTip(hit, 'Difficulty <b>' + b.d + '/10</b><br><span class="tip-num">' + b.n + '</span> phenomena');
    });
    var cap = s('text', { x: padL + plotW / 2, y: H - 1, class: 'tick-label', 'text-anchor': 'middle' });
    cap.textContent = 'harder to resolve →';
    g.appendChild(cap);
    svg.appendChild(g);
  }

  /* ---------- heatmap: evidence x reproducibility ---------- */
  function renderHeat() {
    var box = $('#heat');
    box.innerHTML = '';
    var narrow = window.innerWidth < 560;
    var cells = {}, max = 0;
    EVID.forEach(function (e) {
      cells[e] = {};
      REPRO.forEach(function (r) {
        var n = view.filter(function (d) { return d.evidence_strength === e && d.reproducible === r; }).length;
        cells[e][r] = n;
        if (n > max) max = n;
      });
    });

    box.style.gridTemplateColumns = (narrow ? '62px' : '92px') + ' repeat(' + REPRO.length + ', minmax(0, 1fr))';

    box.appendChild(el('div', 'heat-head', ''));
    REPRO.forEach(function (r) {
      var h = el('div', 'heat-head', narrow ? r.replace('ONE_OFF', '1-off') : REPRO_LABEL[r]);
      h.setAttribute('role', 'columnheader');
      box.appendChild(h);
    });

    EVID.forEach(function (e) {
      var rl = el('div', 'heat-row-label', e.charAt(0) + e.slice(1).toLowerCase());
      rl.setAttribute('role', 'rowheader');
      box.appendChild(rl);
      REPRO.forEach(function (r) {
        var n = cells[e][r];
        var step = n === 0 ? 0 : Math.max(1, Math.round((n / max) * 7));
        var c = el('div', 'heat-cell', n === 0 ? '' : String(n));
        c.style.background = cssVar('--seq-' + step);
        c.style.color = step === 0 ? 'var(--text-muted)'
          : (step >= 4 ? (cssVar('--surface-1') === '#1a1a19' ? '#0b0b0b' : '#fcfcfb') : 'var(--text-primary)');
        c.setAttribute('role', 'cell');
        c.setAttribute('tabindex', '0');
        c.setAttribute('aria-label', e.toLowerCase() + ' evidence, ' + REPRO_LABEL[r].toLowerCase() + ': ' + n + ' phenomena');
        bindTip(c, '<b>' + e.charAt(0) + e.slice(1).toLowerCase() + ' evidence</b><br>' +
          REPRO_LABEL[r] + '<br><span class="tip-num">' + n + '</span> phenomena');
        box.appendChild(c);
      });
    });

    var sc = $('#heat-scale');
    sc.innerHTML = '';
    sc.appendChild(el('span', null, '0'));
    var ramp = el('span', 'scale-ramp');
    for (var i = 0; i <= 7; i++) {
      var st = el('span', 'scale-step');
      st.style.background = cssVar('--seq-' + i);
      ramp.appendChild(st);
    }
    sc.appendChild(ramp);
    sc.appendChild(el('span', null, max + ' phenomena'));
  }

  /* ---------- results list ---------- */
  function tierColor(code) {
    return cssVar('--series-' + groupOf[code].slot);
  }

  function rowNode(d) {
    var row = el('details', 'row');
    var sum = el('summary');

    sum.appendChild(el('span', 'row-id', d.id));

    var main = el('div', 'row-main');
    main.appendChild(el('div', 'row-title', d.phenomenon));
    var meta = el('div', 'row-meta');

    var tier = el('span', 'row-tier');
    var dot = el('span', 'tier-dot');
    dot.style.background = tierColor(d.status_code);
    tier.appendChild(dot);
    tier.appendChild(document.createTextNode(TIERS[tierIndex[d.status_code]].label));
    meta.appendChild(tier);
    meta.appendChild(el('span', null, d.category));
    meta.appendChild(el('span', null, d.evidence_strength.toLowerCase() + ' evidence'));
    if (d.first_documented) meta.appendChild(el('span', null, d.first_documented));
    main.appendChild(meta);
    sum.appendChild(main);

    var dw = el('div', 'row-diff');
    var track = el('div', 'diff-track');
    var fill = el('div', 'diff-fill');
    fill.style.width = (d.diffNum * 10) + '%';
    track.appendChild(fill);
    dw.appendChild(track);
    dw.appendChild(el('div', 'diff-num', String(d.diffNum)));
    dw.title = 'Resolution difficulty ' + d.diffNum + ' of 10';
    sum.appendChild(dw);

    row.appendChild(sum);

    /* detail is built lazily on first open, which keeps 1000 rows cheap on phones */
    var built = false;
    row.addEventListener('toggle', function () {
      if (!row.open || built) return;
      built = true;
      var dl = el('dl', 'detail');
      function add(term, val, full) {
        if (!val) return;
        var wrap = el('div', full ? 'detail-full' : null);
        wrap.appendChild(el('dt', null, term));
        wrap.appendChild(el('dd', null, val));
        dl.appendChild(wrap);
      }
      add('What is observed', d.observation_summary, true);
      add('Why it resists explanation', d.why_it_resists_explanation, true);
      add('Leading hypotheses', d.leading_hypotheses, true);
      add('Where consensus stands', d.mainstream_view, true);
      add('What would resolve it', d.testable_prediction, true);
      add('Key evidence and cases', d.key_evidence_or_cases, true);
      add('Field', d.category + ' / ' + d.domain);
      add('First documented', d.first_documented);
      add('Locus', d.locus);
      add('Reproducible', REPRO_LABEL[d.reproducible] || d.reproducible);
      add('Notable names', d.notable_names);
      add('If solved', d.implication_if_solved);
      row.appendChild(dl);
    });
    return row;
  }

  function renderList(reset) {
    var box = $('#results');
    if (reset) { box.innerHTML = ''; shown = 0; }
    if (!view.length) {
      box.innerHTML = '';
      box.appendChild(el('div', 'empty', 'No phenomena match these filters. Try resetting them.'));
      $('#more-wrap').hidden = true;
      return;
    }
    var frag = document.createDocumentFragment();
    var end = Math.min(shown + PAGE, view.length);
    for (var i = shown; i < end; i++) frag.appendChild(rowNode(view[i]));
    box.appendChild(frag);
    shown = end;
    var mw = $('#more-wrap');
    mw.hidden = shown >= view.length;
    $('#more').textContent = 'Show ' + Math.min(PAGE, view.length - shown) + ' more (' +
      (view.length - shown) + ' remaining)';
  }

  function render() {
    $('#count').textContent = view.length.toLocaleString('en-US');
    renderTiles();
    renderTierChart();
    renderFieldChart();
    renderDiffChart();
    renderHeat();
    renderList(true);
    TIERS.forEach(function (t) {
      var c = document.getElementById('chip-' + t.key);
      if (c) c.setAttribute('aria-pressed', state.tiers[t.key] ? 'true' : 'false');
    });
  }

  /* ---------- controls ---------- */
  function buildControls() {
    var cats = {};
    ALL.forEach(function (d) { cats[d.category] = (cats[d.category] || 0) + 1; });
    var catSel = $('#f-cat');
    Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a] || a.localeCompare(b); })
      .forEach(function (k) {
        var o = el('option', null, k + ' (' + cats[k] + ')');
        o.value = k; catSel.appendChild(o);
      });

    EVID.forEach(function (e) {
      var o = el('option', null, e.charAt(0) + e.slice(1).toLowerCase());
      o.value = e; $('#f-evid').appendChild(o);
    });
    REPRO.forEach(function (r) {
      var o = el('option', null, REPRO_LABEL[r]);
      o.value = r; $('#f-repro').appendChild(o);
    });
    for (var i = 1; i <= 10; i++) {
      var o = el('option', null, i + '+');
      o.value = i; $('#f-diff').appendChild(o);
    }

    var chips = $('#tier-chips');
    TIERS.forEach(function (t) {
      var n = ALL.filter(function (d) { return d.status_code === t.key; }).length;
      var b = el('button', 'chip');
      b.type = 'button';
      b.id = 'chip-' + t.key;
      b.setAttribute('aria-pressed', 'false');
      b.title = t.blurb;
      var sw = el('span', 'tier-dot');
      sw.style.background = cssVar('--series-' + groupOf[t.key].slot);
      b.appendChild(sw);
      b.appendChild(document.createTextNode(t.label + ' '));
      b.appendChild(el('span', 'chip-count', String(n)));
      b.addEventListener('click', function () {
        state.tiers[t.key] = !state.tiers[t.key];
        applyFilters();
      });
      chips.appendChild(b);
    });

    var sorts = [
      { k: 'id', l: 'Dataset order' },
      { k: 'diff', l: 'Hardest first' },
      { k: 'tier', l: 'Most unexplained' },
      { k: 'az', l: 'A to Z' }
    ];
    var sbox = $('#sorts');
    sorts.forEach(function (sd) {
      var b = el('button', 'chip');
      b.type = 'button';
      b.setAttribute('aria-pressed', state.sort === sd.k ? 'true' : 'false');
      b.textContent = sd.l;
      b.addEventListener('click', function () {
        state.sort = sd.k;
        Array.prototype.forEach.call(sbox.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        sortView();
        renderList(true);
      });
      sbox.appendChild(b);
    });

    var deb;
    $('#q').addEventListener('input', function (e) {
      clearTimeout(deb);
      var v = e.target.value;
      deb = setTimeout(function () { state.q = v; applyFilters(); }, 140);
    });
    $('#f-cat').addEventListener('change', function (e) { state.cat = e.target.value; applyFilters(); });
    $('#f-evid').addEventListener('change', function (e) { state.evid = e.target.value; applyFilters(); });
    $('#f-repro').addEventListener('change', function (e) { state.repro = e.target.value; applyFilters(); });
    $('#f-diff').addEventListener('change', function (e) { state.diff = e.target.value; applyFilters(); });
    $('#more').addEventListener('click', function () { renderList(false); });
    $('#reset').addEventListener('click', function () {
      state = { q: '', cat: '', evid: '', repro: '', diff: '', tiers: {}, sort: state.sort };
      $('#q').value = ''; $('#f-cat').value = ''; $('#f-evid').value = '';
      $('#f-repro').value = ''; $('#f-diff').value = '';
      applyFilters();
    });

    /* theme toggle wins over the OS setting in both directions */
    var stored = null;
    try { stored = localStorage.getItem('unexplained-theme'); } catch (e) {}
    if (stored) document.documentElement.setAttribute('data-theme', stored);
    function label() {
      var t = document.documentElement.getAttribute('data-theme');
      $('#theme-label').textContent = t === 'dark' ? 'Dark' : t === 'light' ? 'Light' : 'Theme';
    }
    label();
    $('#theme-btn').addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      var dark = cur ? cur === 'dark'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
      var next = dark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('unexplained-theme', next); } catch (e) {}
      label();
      render();
    });

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        renderTierChart(); renderFieldChart(); renderDiffChart(); renderHeat();
      }, 150);
    });
  }

  /* ---------- boot ---------- */
  fetch(CSV_URL)
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    })
    .then(function (txt) {
      var rows = parseCSV(txt);
      var hdr = rows[0];
      ALL = rows.slice(1).filter(function (r) { return r.length === hdr.length; }).map(function (r) {
        var o = {};
        hdr.forEach(function (h, i) { o[h] = r[i]; });
        o.idNum = +o.id;
        o.diffNum = +o.difficulty_1_10 || 0;
        o.hay = (o.phenomenon + ' ' + o.category + ' ' + o.domain + ' ' + o.locus + ' ' +
                 o.observation_summary + ' ' + o.leading_hypotheses + ' ' +
                 o.key_evidence_or_cases + ' ' + o.notable_names + ' ' +
                 o.why_it_resists_explanation).toLowerCase();
        if (!groupOf[o.status_code]) groupOf[o.status_code] = GROUPS[2];
        if (tierIndex[o.status_code] == null) tierIndex[o.status_code] = TIERS.length;
        return o;
      });
      buildControls();
      applyFilters();
    })
    .catch(function (err) {
      $('#results').appendChild(el('div', 'empty',
        'Could not load the dataset (' + err.message + '). ' +
        'This page needs to be served over HTTP; open it via GitHub Pages or a local server rather than from the filesystem.'));
    });
})();
