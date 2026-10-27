/* ------------------------------------------------------------------
   Price chart for an index or stock, in the style of real finance sites
   (Google Finance, Yahoo Finance): a time-based x axis, prices on the
   right, the period's change in the header, green when the period is
   up and red when it is down, a dashed previous-close line on the
   one-day view, and a crosshair read-out on hover, touch or arrow keys.

   PriceChart.draw(host, {
     points: [[unixSeconds, value], …],          // real data only, in time order
     range: "1D" | "1Y" | "3Y" | "5Y" | "10Y",
     prevClose: number,                          // 1D: change is measured from here
     sessionStart, sessionEnd: unixSeconds,      // 1D: x axis spans the whole session
     name, source, decimals
   })
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg", IST = 5.5 * 3600;
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var UP = "#1F7A4D", DOWN = "#B3261E";
  var PERIOD = { "1D": "today", "1Y": "past year", "3Y": "past 3 years", "5Y": "past 5 years", "10Y": "past 10 years" };

  var el = function (name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  var ist = function (t) { return new Date((t + IST) * 1000); };            // read with getUTC* = IST wall clock
  var hhmm = function (t) { var d = ist(t); return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0"); };
  var dayLabel = function (t, withYear) { var d = ist(t); return d.getUTCDate() + " " + MON[d.getUTCMonth()] + (withYear ? " " + d.getUTCFullYear() : ""); };
  var num = function (v, d) { return v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }); };
  var signed = function (v, d) { return (v > 0 ? "+" : v < 0 ? "−" : "") + num(Math.abs(v), d); };

  function niceTicks(min, max, count) {
    var span = max - min || 1, step = Math.pow(10, Math.floor(Math.log10(span / count)));
    var err = (count * step) / span;
    if (err <= 0.15) step *= 10; else if (err <= 0.35) step *= 5; else if (err <= 0.75) step *= 2;
    var out = [];
    for (var v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(6));
    return out;
  }

  // time ticks at calendar boundaries in IST: hours, months or years
  function timeTicks(t0, t1, range, narrow) {
    var ticks = [], d, t;
    if (range === "1D") {
      var step = narrow ? 2 : 1;
      d = ist(t0); d.setUTCMinutes(0, 0, 0); d.setUTCHours(d.getUTCHours() + 1);
      for (t = d.getTime() / 1000 - IST; t < t1; t += 3600) {
        var h = ist(t).getUTCHours();
        if ((h - 10) % step === 0) ticks.push({ t: t, label: String(h).padStart(2, "0") + ":00" });
      }
      return ticks;
    }
    var everyMonths = { "1Y": narrow ? 3 : 2, "3Y": narrow ? 12 : 6, "5Y": 12, "10Y": narrow ? 36 : 24 }[range] || 12;
    d = ist(t0); d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    for (; ; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
      t = d.getTime() / 1000 - IST;
      if (t > t1) break;
      var m = d.getUTCMonth(), y = d.getUTCFullYear(), idx = y * 12 + m;
      if (everyMonths >= 12) { if (m === 0 && (y % (everyMonths / 12)) === 0) ticks.push({ t: t, label: String(y) }); }
      else if (idx % everyMonths === 0) ticks.push({ t: t, label: m === 0 ? String(y) : (range === "3Y" ? MON[m] + " ’" + String(y).slice(2) : MON[m]) });
    }
    return ticks;
  }

  function draw(host, o) {
    var pts = (o.points || []).filter(function (p) { return p && p[1] != null && isFinite(p[1]); });
    host.innerHTML = "";
    host.classList.add("pc");
    if (pts.length < 2) { host.innerHTML = '<p class="muted">No data for this range.</p>'; return; }
    var dec = o.decimals == null ? 2 : o.decimals;
    var first = pts[0], last = pts[pts.length - 1];
    var base = o.range === "1D" && o.prevClose ? o.prevClose : first[1];
    var chg = last[1] - base, pct = chg / base, color = chg >= 0 ? UP : DOWN;

    // header: price, change over the period, as-of time
    var head = document.createElement("div");
    head.className = "pc__head";
    head.innerHTML =
      '<div class="pc__price"><span class="pc__value">' + num(last[1], dec) + '</span></div>' +
      '<div class="pc__change" style="color:' + color + '"><span aria-hidden="true">' + (chg >= 0 ? "▲" : "▼") + "</span> " +
        signed(chg, dec) + " (" + signed(pct * 100, 2) + "%) <span class=\"pc__period\">" + PERIOD[o.range] + "</span></div>" +
      '<div class="pc__asof">' + (o.range === "1D" ? dayLabel(last[0], true) + ", " + hhmm(last[0]) + " IST" : "Close " + dayLabel(last[0], true)) + (o.source ? " · " + o.source : "") + "</div>";
    host.appendChild(head);

    var wrap = document.createElement("div");
    wrap.className = "pc__plot";
    host.appendChild(wrap);
    var W = Math.max(300, Math.min(760, Math.round(host.clientWidth || 720))), narrow = W < 520;
    var H = narrow ? 230 : 300, m = { t: 14, r: narrow ? 54 : 64, b: 26, l: 6 };

    // 1D: the x axis is the whole NSE session (09:15–15:30 IST) of the day the data belongs to,
    // so a session in progress fills only part of the width, as on real finance sites.
    // (Before the open, data providers report *today's* session times with yesterday's prices.)
    var t0 = first[0], t1 = last[0];
    if (o.range === "1D") {
      var dd = ist(last[0]), midnight = Date.UTC(dd.getUTCFullYear(), dd.getUTCMonth(), dd.getUTCDate()) / 1000 - IST;
      var s0 = o.sessionStart, s1 = o.sessionEnd;
      if (!(s0 && s1 && s0 <= last[0] && s1 >= first[0] && s1 - s0 < 86400)) { s0 = midnight + 9 * 3600 + 15 * 60; s1 = midnight + 15 * 3600 + 30 * 60; }
      t0 = Math.min(s0, first[0]); t1 = Math.max(s1, last[0]);
    }
    var lo = Infinity, hi = -Infinity;
    pts.forEach(function (p) { if (p[1] < lo) lo = p[1]; if (p[1] > hi) hi = p[1]; });
    if (o.range === "1D" && o.prevClose) { lo = Math.min(lo, o.prevClose); hi = Math.max(hi, o.prevClose); }
    var pad = (hi - lo) * 0.08 || hi * 0.01;
    var yt = niceTicks(lo - pad, hi + pad, narrow ? 4 : 5), yMin = Math.min(lo - pad, yt[0]), yMax = Math.max(hi + pad, yt[yt.length - 1]);
    var x = function (t) { return m.l + ((t - t0) / (t1 - t0)) * (W - m.l - m.r); };
    var y = function (v) { return m.t + (1 - (v - yMin) / (yMax - yMin)) * (H - m.t - m.b); };

    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", tabindex: "0", class: "pc__svg",
      "aria-label": (o.name || "Price") + ", " + PERIOD[o.range] + ": from " + num(base, dec) + " to " + num(last[1], dec) + ", " + signed(pct * 100, 2) + "%. Use the arrow keys to read values." }, wrap);

    yt.forEach(function (v) {
      if (v < yMin || v > yMax) return;
      el("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: "pc__grid" }, svg);
      el("text", { x: W - m.r + 8, y: y(v) + 4, class: "pc__tick" }, svg).textContent = num(v, v >= 1000 ? 0 : 2);
    });
    timeTicks(t0, t1, o.range, narrow).forEach(function (tk) {
      var xx = x(tk.t); if (xx < m.l + 14 || xx > W - m.r - 14) return;
      el("line", { x1: xx, x2: xx, y1: H - m.b, y2: H - m.b + 4, class: "pc__axis" }, svg);
      el("text", { x: xx, y: H - 8, "text-anchor": "middle", class: "pc__tick" }, svg).textContent = tk.label;
    });
    el("line", { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: "pc__axis" }, svg);

    if (o.range === "1D" && o.prevClose) {
      el("line", { x1: m.l, x2: W - m.r, y1: y(o.prevClose), y2: y(o.prevClose), class: "pc__prev" }, svg);
    }

    var d = pts.map(function (p, i) { return (i ? "L" : "M") + x(p[0]).toFixed(1) + " " + y(p[1]).toFixed(1); }).join("");
    el("path", { d: d + "L" + x(last[0]).toFixed(1) + " " + (H - m.b) + "L" + x(first[0]).toFixed(1) + " " + (H - m.b) + "Z", fill: color, opacity: 0.09 }, svg);
    el("path", { d: d, fill: "none", stroke: color, "stroke-width": 1.75, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);

    // latest value: a dot on the line and a tag on the price axis
    el("circle", { cx: x(last[0]), cy: y(last[1]), r: 3.5, fill: color }, svg);
    var tagY = Math.max(m.t + 8, Math.min(H - m.b - 8, y(last[1])));
    el("rect", { x: W - m.r + 3, y: tagY - 9, width: m.r - 4, height: 18, rx: 2, fill: color }, svg);
    el("text", { x: W - m.r + 7, y: tagY + 4, class: "pc__tag" }, svg).textContent = num(last[1], last[1] >= 10000 ? 0 : 2);

    // crosshair read-out
    var cross = el("line", { y1: m.t, y2: H - m.b, class: "pc__cross", opacity: 0 }, svg);
    var dot = el("circle", { r: 4.5, fill: color, stroke: "var(--paper)", "stroke-width": 2, opacity: 0 }, svg);
    var tip = document.createElement("div"); tip.className = "pc__tip"; tip.setAttribute("aria-hidden", "true"); wrap.appendChild(tip);
    var live = document.createElement("p"); live.className = "visually-hidden"; live.setAttribute("aria-live", "polite"); wrap.appendChild(live);
    var cur = pts.length - 1;
    var nearest = function (t) {
      var a = 0, b = pts.length - 1;
      while (b - a > 1) { var mid = (a + b) >> 1; if (pts[mid][0] < t) a = mid; else b = mid; }
      return t - pts[a][0] < pts[b][0] - t ? a : b;
    };
    var show = function (i) {
      cur = i; var p = pts[i], cx = x(p[0]), cy = y(p[1]);
      cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("opacity", 1);
      dot.setAttribute("cx", cx); dot.setAttribute("cy", cy); dot.setAttribute("opacity", 1);
      var c = p[1] - base, when = o.range === "1D" ? hhmm(p[0]) + " IST" : dayLabel(p[0], true);
      tip.innerHTML = '<span class="pc__tip-when">' + when + "</span><strong>" + num(p[1], dec) + '</strong><span style="color:' + (c >= 0 ? UP : DOWN) + '">' + signed(c / base * 100, 2) + "%</span>";
      var r = svg.getBoundingClientRect(), px = (cx / W) * r.width, tw = tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(r.width - tw, px - tw / 2)) + "px";
      tip.classList.add("is-on");
      live.textContent = when + ": " + num(p[1], dec);
    };
    var hide = function () { tip.classList.remove("is-on"); cross.setAttribute("opacity", 0); dot.setAttribute("opacity", 0); };
    var fromEvent = function (e) {
      var r = svg.getBoundingClientRect(), sx = ((e.clientX - r.left) / r.width) * W;
      if (sx < m.l || sx > W - m.r) return;
      show(nearest(t0 + ((sx - m.l) / (W - m.l - m.r)) * (t1 - t0)));
    };
    svg.addEventListener("pointermove", fromEvent);
    svg.addEventListener("pointerdown", fromEvent);
    svg.addEventListener("pointerleave", hide);
    svg.addEventListener("blur", hide);
    svg.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? Math.ceil(pts.length / 20) : 1;
      if (e.key === "ArrowLeft") { show(Math.max(0, cur - step)); e.preventDefault(); }
      else if (e.key === "ArrowRight") { show(Math.min(pts.length - 1, cur + step)); e.preventDefault(); }
      else if (e.key === "Home") { show(0); e.preventDefault(); }
      else if (e.key === "End") { show(pts.length - 1); e.preventDefault(); }
    });

    // period stats under the chart
    var stats = document.createElement("dl");
    stats.className = "pc__stats";
    var rows = o.range === "1D"
      ? [["Open", pts[0][1]], ["High", hi === -Infinity ? null : Math.max.apply(null, pts.map(function (p) { return p[1]; }))], ["Low", Math.min.apply(null, pts.map(function (p) { return p[1]; }))], ["Prev close", o.prevClose]]
      : [["Start", first[1]], ["High", Math.max.apply(null, pts.map(function (p) { return p[1]; }))], ["Low", Math.min.apply(null, pts.map(function (p) { return p[1]; }))], ["Latest", last[1]]];
    stats.innerHTML = rows.filter(function (r) { return r[1] != null; }).map(function (r) {
      return "<div><dt>" + (r[0] === "Prev close" ? '<i class="pc__dash" aria-hidden="true"></i>' : "") + r[0] + "</dt><dd>" + num(r[1], dec) + "</dd></div>";
    }).join("");
    host.appendChild(stats);
    return { change: chg, pct: pct, points: pts.length };
  }

  window.PriceChart = { draw: draw };
})();
