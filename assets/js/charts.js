/* ------------------------------------------------------------------
   Small dependency-free SVG charts: a line chart with a hover crosshair
   and a grouped bar chart. Data always comes from real series passed in.
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var el = function (name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  var niceTicks = function (min, max, count) {
    var span = max - min, step = Math.pow(10, Math.floor(Math.log10(span / count)));
    var err = (count * step) / span;
    if (err <= 0.15) step *= 10; else if (err <= 0.35) step *= 5; else if (err <= 0.75) step *= 2;
    var ticks = [], v = Math.ceil(min / step) * step;
    for (; v <= max + 1e-9; v += step) ticks.push(+v.toFixed(10));
    return ticks;
  };
  // draw at the container's real width (capped) so text stays legible on phones
  var width = function (host) { return Math.max(320, Math.min(720, Math.round(host.clientWidth || 720))); };
  var monthLabel = function (m) {
    var p = m.split("-"); return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+p[1] - 1] + " " + p[0];
  };

  /* opts: { labels: ["2023-08", …], series: [{ name, color, values, width, dash, step }], yFormat, tipFormat, yMin, yMax, baseline, height, ariaLabel,
             band: { from, to, label }, xTick(label, i, n, W) -> text|null, xTip(label) -> text } */
  function line(host, opts) {
    var W = width(host), H = opts.height || (W < 500 ? 280 : 340), m = { t: 16, r: W < 500 ? 78 : 118, b: 30, l: W < 500 ? 46 : 62 };
    var n = opts.labels.length;
    var all = [];
    opts.series.forEach(function (s) { all = all.concat(s.values); });
    var yMin = opts.yMin != null ? opts.yMin : Math.min.apply(null, all);
    var yMax = opts.yMax != null ? opts.yMax : Math.max.apply(null, all);
    var ticks = niceTicks(yMin, yMax, 5);
    yMin = Math.min(yMin, ticks[0]); yMax = Math.max(yMax, ticks[ticks.length - 1]);
    var x = function (i) { return m.l + (i / (n - 1)) * (W - m.l - m.r); };
    var y = function (v) { return m.t + (1 - (v - yMin) / (yMax - yMin)) * (H - m.t - m.b); };

    host.style.position = "relative";
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": opts.ariaLabel || "" }, host);
    ticks.forEach(function (t) {
      el("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: t === opts.baseline ? "zero" : "gridline" }, svg);
      var tx = el("text", { x: m.l - 10, y: y(t) + 4, "text-anchor": "end", class: "tick" }, svg);
      tx.textContent = opts.yFormat(t);
    });
    // optional shaded band, e.g. a target range: { from, to, label }
    if (opts.band) {
      el("rect", { x: m.l, y: y(opts.band.to), width: W - m.l - m.r, height: y(opts.band.from) - y(opts.band.to), fill: "var(--blue)", opacity: .16 }, svg);
      if (opts.band.label) el("text", { x: m.l + 6, y: y(opts.band.to) + 13, class: "tick" }, svg).textContent = opts.band.label;
    }
    // optional vertical marker: { at: "2026-06", text: "Study ends" }
    if (opts.marker && opts.labels.indexOf(opts.marker.at) > -1) {
      var mx = x(opts.labels.indexOf(opts.marker.at));
      el("line", { x1: mx, x2: mx, y1: m.t, y2: H - m.b, stroke: "var(--grey)", "stroke-dasharray": "3 3" }, svg);
      el("text", { x: mx - 5, y: m.t + 10, "text-anchor": "end", class: "tick" }, svg).textContent = opts.marker.text;
    }
    // x labels: custom (opts.xTick), quarterly for short spans, else each January
    var short = n <= 16, skip = Math.ceil(n / (W < 500 ? 5 : 8));
    opts.labels.forEach(function (lab, i) {
      var text;
      if (opts.xTick) text = opts.xTick(lab, i, n, W);
      else if (short) text = (n - 1 - i) % 3 === 0 ? monthLabel(lab).replace(/ 20(\d\d)$/, " ’$1") : null;
      else if (lab.slice(5) === "01" && (n < 72 || +lab.slice(0, 4) % Math.ceil(skip / 12) === 0)) text = lab.slice(0, 4);
      else if (i === 0 && W >= 500 && !opts.labels.slice(1, Math.ceil(n / 6)).some(function (l) { return l.slice(5) === "01"; })) text = monthLabel(lab);   // skip if a January label sits too close
      if (!text) return;
      el("text", { x: x(i), y: H - 8, "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle", class: "tick" }, svg).textContent = text;
      el("line", { x1: x(i), x2: x(i), y1: H - m.b, y2: H - m.b + 5, stroke: "var(--grey-light)" }, svg);
    });
    // end labels, nudged apart so they never overlap
    var ends = opts.series.map(function (s) { return { s: s, y: y(s.values[n - 1]) }; }).sort(function (a, b) { return a.y - b.y; });
    for (var i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
    opts.series.forEach(function (s) {
      var d = s.values.map(function (v, i) {
        if (!i) return "M" + x(0).toFixed(1) + " " + y(v).toFixed(1);
        return (s.step ? "H" + x(i).toFixed(1) + "V" : "L" + x(i).toFixed(1) + " ") + y(v).toFixed(1);   // step: hold the level, then jump
      }).join("");
      el("path", { d: d, class: "series", stroke: s.color, "stroke-width": s.width || 2, "stroke-dasharray": s.dash || "none" }, svg);
    });
    ends.forEach(function (e) {
      el("circle", { cx: x(n - 1), cy: y(e.s.values[n - 1]), r: 3, fill: e.s.color }, svg);
      var t = el("text", { x: x(n - 1) + 8, y: e.y + 4, class: "endlabel", fill: "var(--ink)" }, svg);
      t.textContent = W < 500 ? (e.s.tiny || e.s.short || e.s.name) : (e.s.short || e.s.name);
    });

    // hover crosshair
    var cross = el("line", { y1: m.t, y2: H - m.b, stroke: "var(--ink)", "stroke-width": 1, opacity: 0 }, svg);
    var dots = opts.series.map(function (s) { return el("circle", { r: 4, fill: s.color, stroke: "var(--paper)", "stroke-width": 2, opacity: 0 }, svg); });
    var tip = document.createElement("div"); tip.className = "chart-tip"; tip.setAttribute("aria-hidden", "true"); host.appendChild(tip);
    var hit = el("rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: "transparent" }, svg);
    var show = function (evt) {
      var r = svg.getBoundingClientRect(), sx = (evt.clientX - r.left) * (W / r.width);
      var i = Math.max(0, Math.min(n - 1, Math.round(((sx - m.l) / (W - m.l - m.r)) * (n - 1))));
      cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("opacity", .35);
      dots.forEach(function (d, k) { d.setAttribute("cx", x(i)); d.setAttribute("cy", y(opts.series[k].values[i])); d.setAttribute("opacity", 1); });
      tip.innerHTML = "<strong>" + (opts.xTip ? opts.xTip(opts.labels[i]) : monthLabel(opts.labels[i])) + "</strong><br>" + opts.series.map(function (s) {
        return '<span style="display:inline-block;width:8px;height:8px;margin-right:6px;background:' + s.color + '"></span>' + s.name + ": " + opts.tipFormat(s.values[i]);
      }).join("<br>");
      tip.classList.add("is-on");
      var px = (x(i) / W) * r.width, tw = tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(r.width - tw, px + (px > r.width / 2 ? -tw - 14 : 14))) + "px";
      tip.style.top = "8px";
    };
    var hide = function () { tip.classList.remove("is-on"); cross.setAttribute("opacity", 0); dots.forEach(function (d) { d.setAttribute("opacity", 0); }); };
    hit.addEventListener("pointermove", show);
    hit.addEventListener("pointerdown", show);
    hit.addEventListener("pointerleave", hide);
  }

  /* opts: { groups: ["0 bps", …], series: [{ name, color, values }], base, yFormat, labelFormat, ariaLabel } */
  function bars(host, opts) {
    var W = width(host), H = opts.height || 300, m = { t: 22, r: 10, b: 34, l: W < 500 ? 46 : 62 };
    var all = [opts.base];
    opts.series.forEach(function (s) { all = all.concat(s.values); });
    var ticks = niceTicks(Math.min.apply(null, all) * 0.98, Math.max.apply(null, all) * 1.01, 5);
    var yMin = ticks[0], yMax = ticks[ticks.length - 1];
    var y = function (v) { return m.t + (1 - (v - yMin) / (yMax - yMin)) * (H - m.t - m.b); };
    var gw = (W - m.l - m.r) / opts.groups.length, bw = Math.min(46, (gw * 0.6) / opts.series.length);
    host.style.position = "relative";
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": opts.ariaLabel || "" }, host);
    ticks.forEach(function (t) {
      el("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: "gridline" }, svg);
      el("text", { x: m.l - 10, y: y(t) + 4, "text-anchor": "end", class: "tick" }, svg).textContent = opts.yFormat(t);
    });
    var tip = document.createElement("div"); tip.className = "chart-tip"; tip.setAttribute("aria-hidden", "true"); host.appendChild(tip);
    opts.groups.forEach(function (g, gi) {
      var cx = m.l + gw * gi + gw / 2;
      el("text", { x: cx, y: H - 10, "text-anchor": "middle", class: "tick" }, svg).textContent = g;
      opts.series.forEach(function (s, si) {
        var v = s.values[gi], bx = cx - (opts.series.length * bw + 2) / 2 + si * (bw + 2);
        var top = Math.min(y(v), y(opts.base)), h = Math.abs(y(v) - y(opts.base));
        var r = el("rect", { x: bx, y: top, width: bw, height: Math.max(h, 1), fill: s.color }, svg);
        el("text", { x: bx + bw / 2, y: (v >= opts.base ? top - 6 : top + h + 13), "text-anchor": "middle", class: "bar-label" }, svg).textContent = opts.labelFormat(v);
        var hit = el("rect", { x: bx - 1, y: m.t, width: bw + 2, height: H - m.t - m.b, fill: "transparent" }, svg);
        hit.addEventListener("pointerenter", function () {
          tip.innerHTML = "<strong>" + g + "</strong><br>" + s.name + ": " + opts.tipFormat(v);
          tip.classList.add("is-on");
          var rr = svg.getBoundingClientRect();
          tip.style.left = Math.max(0, Math.min(rr.width - tip.offsetWidth, (bx / W) * rr.width - 20)) + "px";
          tip.style.top = "0px";
          r.setAttribute("opacity", .8);
        });
        hit.addEventListener("pointerleave", function () { tip.classList.remove("is-on"); r.setAttribute("opacity", 1); });
      });
    });
    el("line", { x1: m.l, x2: W - m.r, y1: y(opts.base), y2: y(opts.base), class: "zero" }, svg);
  }

  window.Charts = { line: line, bars: bars, monthLabel: monthLabel };
})();
