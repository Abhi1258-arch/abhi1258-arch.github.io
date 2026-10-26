/* ------------------------------------------------------------------
   Page-by-page PDF reader (read.html#<doc id>).
   Phone browsers often show only the first page of a PDF opened inside
   another page, so every page is drawn here with pdf.js instead.
   Pages are drawn as they come near the screen, at the screen's width.
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  var esc = window.Site.esc, url = window.Site.url;
  window.addEventListener("hashchange", function () { location.reload(); });
  var id = decodeURIComponent(location.hash.slice(1));
  var doc = (window.SITE.docs || {})[id];
  var title = document.getElementById("doc-title"), meta = document.getElementById("doc-meta"), host = document.getElementById("doc-pages");

  if (!doc) {
    title.textContent = "Document not found";
    meta.innerHTML = 'Go back to <a href="' + url("projects.html") + '">all projects</a>.';
    return;
  }
  document.title = doc.title;
  title.textContent = doc.title;
  document.getElementById("doc-label").textContent = doc.kind || "Paper";
  document.getElementById("doc-back").innerHTML = '<a href="' + url(doc.back) + '">← ' + esc(doc.backLabel || "Back to the project") + "</a>";
  meta.textContent = "Loading the pages…";

  var lib = window.pdfjsLib;
  if (!lib) { meta.innerHTML = 'The reader could not load. <a href="' + url(doc.file) + '">Open the original file</a>.'; return; }
  lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  lib.getDocument(url(doc.file)).promise.then(function (pdf) {
    meta.innerHTML = pdf.numPages + " pages · <a href=\"" + url(doc.file) + "\">original file</a>";
    var slots = [];
    // placeholders first, sized from page 1, so the scrollbar and page count are right immediately
    return pdf.getPage(1).then(function (first) {
      var vp = first.getViewport({ scale: 1 }), ratio = vp.height / vp.width;
      for (var n = 1; n <= pdf.numPages; n++) {
        var fig = document.createElement("figure");
        fig.className = "doc-page";
        fig.style.aspectRatio = "1 / " + ratio.toFixed(4);
        fig.setAttribute("aria-label", "Page " + n + " of " + pdf.numPages);
        fig.innerHTML = '<span class="doc-page__n" aria-hidden="true">' + n + "</span>";
        host.appendChild(fig);
        slots.push({ n: n, el: fig, done: false });
      }
      var draw = function (s) {
        if (s.done) return; s.done = true;
        pdf.getPage(s.n).then(function (page) {
          var base = page.getViewport({ scale: 1 });
          var cssW = s.el.clientWidth || host.clientWidth, dpr = Math.min(window.devicePixelRatio || 1, 2);
          var vp = page.getViewport({ scale: (cssW / base.width) * dpr });
          var c = document.createElement("canvas");
          c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
          s.el.style.aspectRatio = base.width + " / " + base.height;
          s.el.appendChild(c);
          return page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
        }).then(function () { s.el.classList.add("is-drawn"); }, function () { s.done = false; });
      };
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { if (e.isIntersecting) { draw(slots[+e.target.getAttribute("data-i")]); io.unobserve(e.target); } });
        }, { rootMargin: "1200px 0px" });
        slots.forEach(function (s, i) { s.el.setAttribute("data-i", i); io.observe(s.el); });
      } else slots.forEach(draw);
      // some in-app browsers never report visibility; make sure the opening pages appear regardless
      setTimeout(function () { if (!slots.some(function (s) { return s.done; })) slots.slice(0, 3).forEach(draw); }, 1500);
    });
  }).catch(function () {
    meta.innerHTML = 'This document could not be drawn here. <a href="' + url(doc.file) + '">Open the original file</a>.';
  });
})();
