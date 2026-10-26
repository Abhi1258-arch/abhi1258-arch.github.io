/* ------------------------------------------------------------------
   Live data helper. Talks to the /api endpoints of tools/serve.ps1.
   When the site is opened any other way (a static host, file://),
   Live.available() resolves false and pages keep their saved snapshot.
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  var ping = null;
  var IST = 5.5 * 3600;

  var get = function (path) {
    return fetch(path, { cache: "no-store" }).then(function (r) {
      return r.json().then(function (j) { if (!r.ok || j.error) throw new Error(j.error || r.status); return j; });
    });
  };

  var Live = {
    available: function () {
      if (!ping) {
        ping = location.protocol.indexOf("http") !== 0 ? Promise.resolve(false) :
          Promise.race([
            get("/api/ping").then(function (j) { return !!j.ok; }, function () { return false; }),
            new Promise(function (r) { setTimeout(function () { r(false); }, 2500); })
          ]);
      }
      return ping;
    },
    // symbols: array; p: { range, interval } or { start: "YYYY-MM-DD", interval }
    chart: function (symbols, p) {
      var q = "symbols=" + symbols.map(encodeURIComponent).join(",") + "&interval=" + p.interval + (p.start ? "&start=" + p.start : "&range=" + p.range);
      return get("/api/chart?" + q);
    },
    get: get,
    // monthly Yahoo series -> [[ "YYYY-MM", value ], …], one value per IST month (latest wins)
    monthly: function (s, useAdj) {
      var out = [], vals = useAdj ? s.a : s.c;
      (s.t || []).forEach(function (t, i) {
        var v = vals[i]; if (v == null) return;
        var d = new Date((t + IST) * 1000), ym = d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
        if (out.length && out[out.length - 1][0] === ym) out[out.length - 1][1] = v; else out.push([ym, v]);
      });
      return out;
    },
    // is the exchange in its regular session right now? (uses the trading period Yahoo reports)
    isOpen: function (s) { var now = Date.now() / 1000; return !!s && now >= s.tradingStart && now <= s.tradingEnd; },
    timeIST: function (unix) {
      var d = new Date((unix + IST) * 1000);
      return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0") + " IST";
    },
    dateIST: function (unix) {
      var d = new Date((unix + IST) * 1000);
      return d.getUTCDate() + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()] + " " + d.getUTCFullYear();
    },
    thisMonthIST: function () { var d = new Date(Date.now() + IST * 1000); return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0"); },
    // run fn now and then every ms while the tab is visible; returns a stop function
    every: function (ms, fn) {
      var id = setInterval(function () { if (!document.hidden) fn(); }, ms);
      var onVis = function () { if (!document.hidden) fn(); };
      document.addEventListener("visibilitychange", onVis);
      return function () { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
    }
  };
  window.Live = Live;
})();
