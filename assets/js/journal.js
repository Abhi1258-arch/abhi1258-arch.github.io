/* Weekly journal helpers shared by the journal page and the Observatory.
   Entries whose week starts after SITE.journal.authoredThrough were added by the
   Sunday automation, not written by hand, and are labelled as such. */
(function () {
  "use strict";
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  // "October 19 – October 25, 2026" -> "2026-10-19" (handles weeks that cross into a new year)
  var startDate = function (title) {
    var m = title.match(/^([A-Za-z]+)\s+(\d+).*?(\d{4})\s*$/), end = title.match(/([A-Za-z]+)\s+\d+,\s*\d{4}\s*$/);
    if (!m) return null;
    var mo = MONTHS.indexOf(m[1]), year = +m[3];
    if (end && MONTHS.indexOf(end[1]) < mo) year -= 1;
    return year + "-" + String(mo + 1).padStart(2, "0") + "-" + String(+m[2]).padStart(2, "0");
  };
  window.Journal = {
    startDate: startDate,
    isAutomated: function (title) {
      var cfg = (window.SITE && window.SITE.journal) || {}, d = startDate(title);
      return !!(cfg.authoredThrough && d && d > cfg.authoredThrough);
    }
  };
})();
