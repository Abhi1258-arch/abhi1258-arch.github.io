/* ------------------------------------------------------------------
   Continues the momentum / mean-reversion backtest past the paper's
   study window (Aug 2023 – Jun 2026) with live monthly prices, using
   exactly the paper's rules:
     signal  = each stock's return in the previous month
     momentum = the 2 highest signals, mean reversion = the 2 lowest
     50/50 weights, monthly rebalance, zero costs, Nifty 50 buy-and-hold.
   The study period itself is never changed: new months are chained onto
   the official values from backtest-data.js. Before extending, the same
   rules are re-run over the study period on live data and must reproduce
   the official results; otherwise no extension is shown.
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  var STOCKS = { RELIANCE: "RELIANCE.NS", TCS: "TCS.NS", HDFCBANK: "HDFCBANK.NS", INFY: "INFY.NS", ICICIBANK: "ICICIBANK.NS" };
  var NIFTY = "^NSEI";
  var TOLERANCE = 0.005;   // re-run must match the official values within 0.5%

  function pickTwo(prices, names, mPrev, mPrev2, highest) {
    var ranked = names.map(function (n) { return { n: n, s: prices[n][mPrev] / prices[n][mPrev2] - 1 }; })
      .sort(function (a, b) { return highest ? b.s - a.s : a.s - b.s; });
    return [ranked[0].n, ranked[1].n];
  }
  function monthRet(prices, picks, m, mPrev) {
    return (prices[picks[0]][m] / prices[picks[0]][mPrev] + prices[picks[1]][m] / prices[picks[1]][mPrev]) / 2 - 1;
  }

  /* B: window.BACKTEST, raw: result of Live.chart([...stocks, ^NSEI], { start: "2023-06-01", interval: "1mo" }) */
  function run(B, raw, currentMonth) {
    var names = Object.keys(STOCKS), prices = {}, months = null;
    names.forEach(function (n) {
      var rows = Live.monthly(raw[STOCKS[n]], true);
      prices[n] = {}; rows.forEach(function (r) { prices[n][r[0]] = r[1]; });
      var ms = rows.map(function (r) { return r[0]; });
      months = months ? months.filter(function (m) { return ms.indexOf(m) > -1; }) : ms;
    });
    var nifty = {}; Live.monthly(raw[NIFTY], false).forEach(function (r) { nifty[r[0]] = r[1]; });
    months = months.filter(function (m) { return m >= B.months[0] && nifty[m] != null; });

    // 1. reproduce the study period from live prices
    var sim = { momentum: [100000], meanReversion: [100000], nifty: [100000] };
    for (var i = 1; i < months.length; i++) {
      var m = months[i], p = months[i - 1];
      sim.nifty.push(sim.nifty[i - 1] * nifty[m] / nifty[p]);
      if (i < 2) { sim.momentum.push(100000); sim.meanReversion.push(100000); continue; }
      var p2 = months[i - 2];
      sim.momentum.push(sim.momentum[i - 1] * (1 + monthRet(prices, pickTwo(prices, names, p, p2, true), m, p)));
      sim.meanReversion.push(sim.meanReversion[i - 1] * (1 + monthRet(prices, pickTwo(prices, names, p, p2, false), m, p)));
    }
    var worst = 0;
    B.months.forEach(function (m, k) {
      var j = months.indexOf(m); if (j < 0) { worst = Infinity; return; }
      ["momentum", "meanReversion", "nifty"].forEach(function (s) { worst = Math.max(worst, Math.abs(sim[s][j] / B.value[s][k] - 1)); });
    });
    var ok = worst <= TOLERANCE;

    // 2. chain new months onto the official values
    var out = { ok: ok, maxDiff: worst, months: B.months.slice(), value: {}, extension: [], current: currentMonth || Live.thisMonthIST() };
    ["momentum", "meanReversion", "nifty"].forEach(function (s) { out.value[s] = B.value[s].slice(); });
    if (ok) {
      var last = B.months[B.months.length - 1];
      months.filter(function (m) { return m > last; }).forEach(function (m) {
        var i = months.indexOf(m), p = months[i - 1], p2 = months[i - 2];
        var mp = pickTwo(prices, names, p, p2, true), rp = pickTwo(prices, names, p, p2, false);
        var r = { momentum: monthRet(prices, mp, m, p), meanReversion: monthRet(prices, rp, m, p), nifty: nifty[m] / nifty[p] - 1 };
        out.months.push(m);
        ["momentum", "meanReversion", "nifty"].forEach(function (s) { var v = out.value[s]; v.push(v[v.length - 1] * (1 + r[s])); });
        out.extension.push({ month: m, partial: m === out.current, momentumPicks: mp, meanReversionPicks: rp, ret: r,
          value: { momentum: out.value.momentum[out.value.momentum.length - 1], meanReversion: out.value.meanReversion[out.value.meanReversion.length - 1], nifty: out.value.nifty[out.value.nifty.length - 1] } });
      });
    }
    out.drawdown = {};
    ["momentum", "meanReversion", "nifty"].forEach(function (s) {
      var peak = -Infinity; out.drawdown[s] = out.value[s].map(function (v) { peak = Math.max(peak, v); return v / peak - 1; });
    });
    return out;
  }

  window.LiveBacktest = {
    symbols: Object.keys(STOCKS).map(function (k) { return STOCKS[k]; }).concat([NIFTY]),
    load: function (B) {
      return Live.chart(window.LiveBacktest.symbols, { start: "2023-06-01", interval: "1mo" }).then(function (raw) { return run(B, raw); });
    },
    // the same calculation from the saved snapshot (observatory-data.js), for the shared site
    fromSnapshot: function (B, D) {
      if (!D || !D.stocks) return null;
      var o = run(B, D.stocks, D.nifty.asOf.slice(0, 7));
      o.asOf = D.nifty.asOf;
      return o;
    }
  };
})();
