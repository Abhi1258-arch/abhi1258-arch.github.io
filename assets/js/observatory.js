/* ------------------------------------------------------------------
   Indian Market Observatory.
   Renders from the saved snapshot first (observatory-data.js etc.), then,
   when the page is served by tools/serve.ps1, replaces every module with
   live data and refreshes it every minute. Opened any other way, the
   page stays on the snapshot and says so.
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  var D = window.OBSERVATORY, R = window.RBI_REPO, B = window.BACKTEST, esc = window.Site.esc, url = window.Site.url;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var day = function (iso) { var p = iso.split("-"); return +p[2] + " " + MONTHS[+p[1] - 1] + " " + p[0]; };
  var num = function (v, d) { return v.toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var pct = function (v, d) { return v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v * 100).toFixed(d == null ? 1 : d) + "%"; };
  var facts = function (id, rows) {
    document.getElementById(id).innerHTML = rows.map(function (r) { return "<div><dt>" + r[0] + "</dt><dd>" + r[1] + "</dd></div>"; }).join("");
  };
  var chips = function (id, list, current, onPick) {
    var host = document.getElementById(id);
    host.innerHTML = list.map(function (c) { return '<button class="chip" type="button" aria-pressed="' + (c[0] === current) + '" data-k="' + c[0] + '">' + c[1] + "</button>"; }).join("");
    host.addEventListener("click", function (e) {
      var b = e.target.closest(".chip"); if (!b) return;
      Array.prototype.forEach.call(host.children, function (c) { c.setAttribute("aria-pressed", String(c === b)); });
      onPick(b.getAttribute("data-k"));
    });
  };
  // return over k months from a [[month, close], …] series (last row = latest close)
  var ret = function (rows, k) { var n = rows.length; return n > k ? rows[n - 1][1] / rows[n - 1 - k][1] - 1 : null; };
  // daily series [[unixSeconds, close], …]: index of the last close on or before the same calendar date k months earlier,
  // the convention finance sites use, so the chart, the figures and the sector table all agree
  var startIndex = function (pts, k) {
    var d = new Date((pts[pts.length - 1][0] + 19800) * 1000);
    var target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - k, d.getUTCDate(), 23, 59) / 1000 - 19800;
    if (pts[0][0] > target) return -1;
    var a = 0, b = pts.length - 1;
    while (a < b) { var mid = (a + b + 1) >> 1; if (pts[mid][0] <= target) a = mid; else b = mid - 1; }
    return a;
  };
  var retDaily = function (pts, k) { var i = pts && pts.length ? startIndex(pts, k) : -1; return i < 0 ? null : pts[pts.length - 1][1] / pts[i][1] - 1; };

  /* state: starts as the snapshot, replaced piece by piece by live data */
  var S = {
    live: false, liveTime: null, open: false,
    nifty: { last: D.nifty.last, asOfText: day(D.nifty.asOf), monthly: D.nifty.monthly, series: D.nifty.series },
    sectors: D.sectors.map(function (s) { return { name: s.sector, symbol: s.symbol, points: s.points }; }),
    cpi: D.cpi.annual, repoLive: null,
    backtest: (function () {
      var s = LiveBacktest.fromSnapshot(B, D);
      return s && s.ok ? { months: s.months, value: s.value, extended: s.extension.length > 0 } : { months: B.months, value: B.value, extended: false };
    })(),
    journal: (window.JOURNAL || []).map(function (e) { return { title: e.title, sections: e.sections }; }),
    niftyRange: "1Y", sectorPeriod: "12"
  };

  function renderStatus() {
    var el = document.getElementById("snapshot");
    if (S.live) {
      el.innerHTML = '<span class="live-dot' + (S.open ? "" : " is-closed") + '" aria-hidden="true"></span><strong>' + (S.open ? "Live, market open." : "Live, market closed.") + "</strong> " +
        "Updated " + S.liveTime + " · refreshes every minute · Yahoo Finance prices may be delayed up to 15 minutes · repo rate read from rbi.org.in.";
    } else {
      el.innerHTML = "<strong>Data as of " + day(D.nifty.asOf) + ".</strong> Prices from Yahoo Finance, inflation from the World Bank, the repo rate from rbi.org.in.";
    }
  }

  /* ---------------- 01 Nifty 50 */
  function renderNifty() {
    var daily = S.nifty.series.daily.points, last = daily[daily.length - 1][1];
    var peak = daily.reduce(function (a, p) { return p[1] > a[1] ? p : a; });
    var r5 = retDaily(daily, 60), pd = new Date((peak[0] + 19800) * 1000);
    facts("nifty-facts", [
      ["1 month", pct(retDaily(daily, 1))], ["1 year", pct(retDaily(daily, 12))],
      ["5 years", pct(r5) + '<br><span class="muted small">' + pct(Math.pow(1 + r5, 1 / 5) - 1) + " a year</span>"],
      ["From 5-year high", pct(last / peak[1] - 1) + '<br><span class="muted small">high: ' + num(peak[1], 2) + ", " + pd.getUTCDate() + " " + MONTHS[pd.getUTCMonth()] + " " + pd.getUTCFullYear() + "</span>"]
    ]);
    var SRC = { "1D": "1-minute prices", "1Y": "daily closes", "3Y": "daily closes", "5Y": "daily closes", "10Y": "weekly closes" };
    document.getElementById("nifty-caption").textContent = "Source: Yahoo Finance (^NSEI), " + SRC[S.niftyRange] + "; prices may be delayed up to 15 minutes. Price index, dividends excluded. Hover, tap or use the arrow keys on the chart to read any point.";
    var se = S.nifty.series, range = S.niftyRange, pts, opt = { range: range, name: "Nifty 50" };
    if (range === "1D") {
      pts = se.intraday.points;
      opt.prevClose = se.intraday.prevClose; opt.sessionStart = se.intraday.sessionStart; opt.sessionEnd = se.intraday.sessionEnd;
    } else if (range === "10Y") {
      pts = se.weekly.points;
    } else {
      var i0 = startIndex(daily, { "1Y": 12, "3Y": 36, "5Y": 60 }[range]);
      pts = daily.slice(Math.max(0, i0));
    }
    PriceChart.draw(document.getElementById("chart-nifty"), Object.assign(opt, { points: pts }));
  }
  // redraw at the new width when a phone rotates or the window is resized
  var resizeTimer = null, lastW = window.innerWidth;
  window.addEventListener("resize", function () {
    if (Math.abs(window.innerWidth - lastW) < 40) return;
    lastW = window.innerWidth; clearTimeout(resizeTimer); resizeTimer = setTimeout(renderNifty, 200);
  });

  /* ---------------- 02 Sectors */
  var PERIODS = [["1", "1 month"], ["3", "3 months"], ["6", "6 months"], ["12", "1 year"], ["36", "3 years"]];
  function renderSectors() {
    var k = +S.sectorPeriod;
    var list = S.sectors.map(function (s) { return { name: s.name, r: retDaily(s.points, k) }; }).filter(function (s) { return s.r !== null; });
    list.push({ name: "Nifty 50", r: retDaily(S.nifty.series.daily.points, k), bench: true });
    list.sort(function (a, b) { return b.r - a.r; });
    var max = Math.max.apply(null, list.map(function (s) { return Math.abs(s.r); })) || 1;
    var label = PERIODS.filter(function (p) { return p[0] === String(k); })[0][1];
    document.getElementById("sector-table").innerHTML = "<caption>Price return over " + label + ", to " + S.nifty.asOfText + "</caption>" +
      '<thead><tr><th scope="col">Index</th><th scope="col" class="num">Return</th><th scope="col" style="width:45%"><span class="visually-hidden">Bar</span></th></tr></thead><tbody>' +
      list.map(function (s) {
        var w = (Math.abs(s.r) / max) * 50;
        return "<tr" + (s.bench ? ' class="is-bench"' : "") + '><th scope="row" style="font-weight:' + (s.bench ? 600 : 400) + '">' + esc(s.name) + '</th><td class="num">' + pct(s.r) + "</td>" +
          '<td><div class="divbar" aria-hidden="true"><span class="' + (s.r < 0 ? "neg" : "pos") + (s.bench ? " bench" : "") + '" style="' + (s.r < 0 ? "right:50%" : "left:50%") + ";width:" + w + '%"></span></div></td></tr>';
      }).join("") + "</tbody>";
  }

  /* ---------------- 03 CPI */
  function renderCpi() {
    var rows = S.cpi, last = rows[rows.length - 1];
    var outside = rows.filter(function (r) { return r[0] >= 2016 && (r[1] > 6 || r[1] < 2); }).map(function (r) { return r[0]; });
    var hi = rows.reduce(function (a, r) { return r[1] > a[1] ? r : a; });
    facts("cpi-facts", [
      ["Latest year", last[0] + ": " + last[1].toFixed(1) + "%"],
      ["Previous year", rows[rows.length - 2][0] + ": " + rows[rows.length - 2][1].toFixed(1) + "%"],
      ["Highest since 2000", hi[0] + ": " + hi[1].toFixed(1) + "%"],
      ["Years outside 2–6% since 2016", outside.length ? outside.join(", ") : "None"]
    ]);
    var host = document.getElementById("chart-cpi"); host.innerHTML = "";
    Charts.line(host, {
      labels: rows.map(function (r) { return String(r[0]); }),
      series: [{ name: "CPI inflation", short: "CPI", color: "#556676", values: rows.map(function (r) { return r[1]; }) }],
      yMin: 0, baseline: 0, endValues: true, dots: true, band: { from: 2, to: 6, label: "RBI tolerance band 2–6%" },
      xTick: function (lab, i, n) { return +lab % 5 === 0 || i === n - 1 ? lab : null; },
      xTip: function (lab) { return lab; },
      yFormat: function (v) { return v + "%"; }, tipFormat: function (v) { return v.toFixed(2) + "%"; },
      ariaLabel: "Line chart of India's annual CPI inflation from " + rows[0][0] + " to " + last[0] + ", latest " + last[1] + "%."
    });
  }

  /* ---------------- 04 RBI repo rate */
  function renderRepo() {
    var ch = R.changes, cur = ch[ch.length - 1], prev = ch[ch.length - 2];
    var end = (S.nifty.monthly[S.nifty.monthly.length - 1] || [])[0], labels = [], values = [], m = "2015-01";
    var rateAt = function (ym) { var v = null; ch.forEach(function (c) { if (c[0].slice(0, 7) <= ym) v = c[1]; }); return v; };
    while (m <= end) {
      labels.push(m); values.push(rateAt(m));
      var y = +m.slice(0, 4), mo = +m.slice(5) + 1; if (mo > 12) { mo = 1; y++; } m = y + "-" + String(mo).padStart(2, "0");
    }
    var lo = ch.reduce(function (a, c) { return c[1] < a[1] ? c : a; });
    var mismatch = S.repoLive != null && Math.abs(S.repoLive - cur[1]) > 1e-9;
    facts("repo-facts", [
      ["Current rate", (S.repoLive != null ? S.repoLive : cur[1]).toFixed(2) + "%" + (S.repoLive != null ? '<br><span class="muted small">live from rbi.org.in</span>' : "")],
      ["Last change", day(cur[0]) + '<br><span class="muted small">' + (cur[1] > prev[1] ? "hike" : "cut") + " of " + Math.round(Math.abs(cur[1] - prev[1]) * 100) + " bps</span>"],
      ["Lowest since 2015", lo[1].toFixed(2) + "%<br><span class=\"muted small\">from " + day(lo[0]) + "</span>"],
      ["Next MPC meeting", day(R.nextMeeting)]
    ]);
    if (mismatch) document.getElementById("repo-facts").insertAdjacentHTML("afterend", '<p class="note" id="repo-warn"><strong>The RBI site now shows ' + S.repoLive.toFixed(2) + "%.</strong> The timeline below ends at " + cur[1].toFixed(2) + "% and needs the new decision added to observatory-rbi.js.</p>");
    var host = document.getElementById("chart-repo"); host.innerHTML = "";
    Charts.line(host, {
      labels: labels, height: 260, endValues: true,
      series: [{ name: "Repo rate", short: "Repo", color: "#5F5679", values: values, step: true }],
      yMin: 3.5, yMax: 8, yFormat: function (v) { return v.toFixed(1) + "%"; }, tipFormat: function (v) { return v.toFixed(2) + "%"; },
      ariaLabel: "Step chart of the RBI repo rate since January 2015, currently " + cur[1].toFixed(2) + "%."
    });
    document.getElementById("repo-table").innerHTML = '<thead><tr><th scope="col">Decision</th><th scope="col" class="num">Change</th><th scope="col" class="num">Repo rate</th></tr></thead><tbody>' +
      ch.map(function (c, i) {
        var d = i ? Math.round((c[1] - ch[i - 1][1]) * 100) : null;
        return "<tr><td>" + day(c[0]) + '</td><td class="num">' + (d === null ? "—" : (d > 0 ? "+" : "−") + Math.abs(d) + " bps") + '</td><td class="num">' + c[1].toFixed(2) + "%</td></tr>";
      }).reverse().join("") + "</tbody>";
    document.getElementById("repo-caption").textContent = "Source: RBI monetary policy statements. Meetings that held the rate are not listed. Timeline checked against rbi.org.in on " + day(R.checked) + ".";
  }

  /* ---------------- 05 Strategy results */
  var STRAT = [
    { key: "momentum", name: "Momentum", tiny: "Mom.", color: "#5F5679" },
    { key: "meanReversion", name: "Mean reversion", short: "Mean rev.", color: "#B07A2E" },
    { key: "nifty", name: "Nifty 50 Price Index", short: "Nifty 50", color: "#252522", width: 2.5 }
  ];
  function renderStrategies() {
    var bt = S.backtest, last = bt.months.length - 1;
    document.getElementById("legend-strat").innerHTML = STRAT.map(function (s) { return '<li><i style="background:' + s.color + '"></i>' + s.name + "</li>"; }).join("");
    document.getElementById("strat-note").textContent = bt.extended
      ? "Study period August 2023 – June 2026, then the same rules tracked forward. Latest: momentum ₹" + num(bt.value.momentum[last]) + ", mean reversion ₹" + num(bt.value.meanReversion[last]) + ", Nifty 50 ₹" + num(bt.value.nifty[last]) + "."
      : "My backtest of two monthly rules on five large caps, August 2023 – June 2026. Over the study, neither beat the index.";
    var host = document.getElementById("chart-strat"); host.innerHTML = "";
    Charts.line(host, {
      labels: bt.months, baseline: 100000, height: 300, endValues: true, marker: bt.extended ? { at: "2026-06", text: "Study ends" } : null,
      series: STRAT.map(function (s) { return Object.assign({ values: bt.value[s.key] }, s); }),
      yFormat: function (v) { return "₹" + Math.round(v / 1000) + "k"; }, tipFormat: function (v) { return "₹" + num(v); },
      ariaLabel: "Value of ₹100,000 in each portfolio from August 2023" + (bt.extended ? ", continued after June 2026 with the same rules." : " to June 2026.")
    });
  }

  /* ---------------- 06 Journal and notes */
  function renderJournal() {
    var J = S.journal.slice(-3).reverse();
    document.getElementById("journal-latest").innerHTML = J.map(function (e) {
      var first = (e.sections[0] && e.sections[0].paragraphs[0]) || "";
      return '<li><a href="journal.html">' + esc(e.title) + "</a>" +
        '<span class="muted small">' + esc(first.length > 140 ? first.slice(0, first.lastIndexOf(" ", 140)) + "…" : first) + "</span></li>";
    }).join("");
    document.getElementById("journal-count").textContent = "All " + S.journal.length + " weeks";
    var notes = [{ title: "Inflation and the Indian Middle Class", href: "inflation.html" }, { title: "UPI and Behavioural Finance", href: "upi.html" }]
      .concat(window.SITE.notes.map(function (n) { return { title: n.title, href: window.Site.doc(n.doc), pdf: true }; }));
    document.getElementById("notes-list").innerHTML = notes.map(function (n) {
      return '<li><a href="' + n.href + '">' + esc(n.title) + "</a>" + (n.pdf ? '<span class="muted small">PDF</span>' : "") + "</li>";
    }).join("");
  }

  function renderAll() { renderStatus(); renderNifty(); renderSectors(); renderCpi(); renderRepo(); renderStrategies(); renderJournal(); }

  chips("nifty-range", [["1D", "1D"], ["1Y", "1Y"], ["3Y", "3Y"], ["5Y", "5Y"], ["10Y", "10Y"]], S.niftyRange, function (k) { S.niftyRange = k; renderNifty(); });
  chips("sector-period", PERIODS, S.sectorPeriod, function (k) { S.sectorPeriod = k; renderSectors(); });
  renderAll();

  /* ---------------- live updates */
  function refresh() {
    var soft = function (p) { return p.then(null, function () { return null; }); };
    return Promise.all([
      soft(Live.chart(["^NSEI"], { range: "10y", interval: "1mo" })),
      soft(Live.chart(["^NSEI"], { range: "1d", interval: "1m" })),
      soft(Live.chart(["^NSEI"], { range: "5y", interval: "1d" })),
      soft(Live.chart(["^NSEI"], { range: "10y", interval: "1wk" })),
      soft(Live.chart(S.sectors.map(function (s) { return s.symbol; }), { range: "5y", interval: "1d" })),
      soft(Live.get("/api/cpi")),
      soft(Live.get("/api/rbi")),
      soft(LiveBacktest.load(B)),
      soft(Live.get("/api/journal"))
    ]).then(function (r) {
      var got = false;
      if (r[0] && r[0]["^NSEI"].t) {
        var q = r[0]["^NSEI"];
        S.nifty.monthly = Live.monthly(q, false).slice(-120);
        S.nifty.last = q.price; S.nifty.asOfText = Live.dateIST(q.time) + ", " + Live.timeIST(q.time);
        S.open = Live.isOpen(q); got = true;
      }
      // price-chart series, in the same shape as the snapshot
      var toSeries = function (x) {
        return { points: x.t.map(function (t, i) { return [t, x.c[i]]; }).filter(function (p) { return p[1] != null; }),
          prevClose: x.prevClose, price: x.price, time: x.time, sessionStart: x.tradingStart, sessionEnd: x.tradingEnd };
      };
      var ser = {};
      [["intraday", r[1]], ["daily", r[2]], ["weekly", r[3]]].forEach(function (p) { if (p[1] && p[1]["^NSEI"] && p[1]["^NSEI"].t) ser[p[0]] = toSeries(p[1]["^NSEI"]); });
      if (ser.intraday && ser.daily && ser.weekly) S.nifty.series = ser;
      if (r[4]) S.sectors.forEach(function (s) { var x = r[4][s.symbol]; if (x && x.t) s.points = x.t.map(function (t, i) { return [t, x.c[i]]; }).filter(function (p) { return p[1] != null; }).slice(-820); });
      if (r[5] && r[5].annual) S.cpi = r[5].annual;
      if (r[6] && r[6].repo) S.repoLive = r[6].repo;
      if (r[7] && r[7].ok) S.backtest = { months: r[7].months, value: r[7].value, extended: r[7].extension.length > 0 };
      if (r[8] && r[8].entries) S.journal = r[8].entries;
      if (got) { S.live = true; S.liveTime = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }); }
      var warn = document.getElementById("repo-warn"); if (warn) warn.remove();
      renderAll();
    });
  }
  Live.available().then(function (yes) {
    if (!yes) return;
    document.getElementById("snapshot").innerHTML = "Connecting to live data…";
    refresh();
    Live.every(60000, refresh);
  });
})();
