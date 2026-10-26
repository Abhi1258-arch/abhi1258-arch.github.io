/* ------------------------------------------------------------------
   Screenplay reader.
   Reads the original PDF in the browser (pdf.js) and typesets it as HTML
   without changing a word: text runs are kept in order, bold runs stay bold,
   and each paragraph is only *classified* (scene heading, dialogue, action,
   transition, part title) for styling and navigation.
   If the result fails an integrity check, the original PDF is shown instead.

   Used by expression/screenplay.html (full reader) and by any element with
   [data-screenplay-excerpt="12-13"] (scene range) on the film page.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var ROOT = document.body.getAttribute("data-root") || "";
  var PDF_URL = ROOT + "assets/docs/everything-was-already-alive.pdf";
  var WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  var SCENE_RE = /^(\d+)\.\s+(INT|EXT|INT\.\/EXT|EXT\.\/INT)\b/;
  var CUE_RE = /^[A-Z][A-Z' ]+( \([A-Z.'’ ]+\))*:$/;
  var LABEL_WORDS = /FOOTAGE|SCREEN|INSERT|TITLE|FADE/;
  var TRANS_RE = /^(FADE IN:|FADE OUT\.?|FADE TO BLACK\.?|CUT TO:|CUT TO BLACK\.?|SMASH CUT TO:|DISSOLVE TO:|THE END\.?)$/;

  /* ---------------- stage 1: PDF -> positioned lines made of font runs */
  function readPage(page) {
    return page.getTextContent().then(function (tc) {
      var items = [];
      tc.items.forEach(function (it) {
        if (it.str === undefined || it.str === "") return;
        var t = it.transform;
        items.push({ s: it.str, x: t[4], y: t[5], w: it.width, size: Math.round(Math.hypot(t[2], t[3]) * 10) / 10, f: it.fontName });
      });
      items.sort(function (a, b) { return b.y - a.y || a.x - b.x; });
      var lines = [];
      items.forEach(function (it) {
        var L = lines[lines.length - 1];
        if (L && Math.abs(L.y - it.y) < Math.max(2, it.size * 0.35)) L.items.push(it);
        else lines.push({ y: it.y, items: [it] });
      });
      return lines.map(function (L) {
        L.items.sort(function (a, b) { return a.x - b.x; });
        var runs = [], end = null, size = 0;
        L.items.forEach(function (it) {
          var s = it.s;
          if (end !== null && it.x - end > it.size * 0.12) s = " " + s;
          end = it.x + it.w; size = Math.max(size, it.size);
          var last = runs[runs.length - 1];
          if (last && last.f === it.f) last.s += s; else runs.push({ s: s, f: it.f });
        });
        var text = runs.map(function (r) { return r.s; }).join("").replace(/\s+/g, " ").trim();
        return { page: page.pageNumber, y: L.y, x: Math.round(L.items[0].x), size: size, runs: runs, text: text };
      }).filter(function (l) { return l.text; });
    });
  }

  /* ---------------- stage 2: lines -> paragraphs */
  function toParagraphs(lines) {
    // body size = most common; header/footer = smaller than body
    var count = {};
    lines.forEach(function (l) { count[l.size] = (count[l.size] || 0) + 1; });
    var body = +Object.keys(count).sort(function (a, b) { return count[b] - count[a]; })[0];
    lines = lines.filter(function (l) { return l.size >= body * 0.8; });

    // the bold font is the one used by scene headings
    var bold = null;
    lines.some(function (l) { if (SCENE_RE.test(l.text)) { bold = l.runs[0].f; return true; } return false; });

    var paras = [], cur = null, prev = null;
    var terminal = /[.!?:"”’)\]—…]$/;
    lines.forEach(function (l) {
      var big = l.size > body * 1.15;
      var gap = prev && prev.page === l.page ? prev.y - l.y : null;
      var samePara = cur && !big && !cur.big && l.x === cur.x &&
        ((gap !== null && gap < body * 1.62) ||
         (gap === null && prev && l.page === prev.page + 1 && !terminal.test(cur.text) && !SCENE_RE.test(l.text) && !SCENE_RE.test(cur.text) && !TRANS_RE.test(cur.text)));
      if (samePara) {
        var join = /-$/.test(cur.text) && !/—$/.test(cur.text) ? "" : " ";
        l.runs.forEach(function (r, i) {
          var s = i === 0 ? join + r.s.replace(/^\s+/, "") : r.s;
          var last = cur.runs[cur.runs.length - 1];
          if (last.f === r.f) last.s += s; else cur.runs.push({ s: s, f: r.f });
        });
        cur.text = (cur.text + join + l.text).replace(/\s+/g, " ");
      } else {
        cur = { page: l.page, x: l.x, size: l.size, big: big, huge: l.size > body * 1.7, runs: l.runs.map(function (r) { return { s: r.s, f: r.f }; }), text: l.text };
        paras.push(cur);
      }
      prev = l;
    });
    paras.forEach(function (p) {
      p.runs.forEach(function (r) { r.b = r.f === bold; r.s = r.s.replace(/\s+/g, " "); });
      p.runs = p.runs.filter(function (r) { return r.s !== ""; });
      if (p.runs.length) { p.runs[0].s = p.runs[0].s.replace(/^\s+/, ""); var z = p.runs[p.runs.length - 1]; z.s = z.s.replace(/\s+$/, ""); }
      p.allBold = p.runs.every(function (r) { return r.b || !r.s.trim(); });
    });
    return { paras: paras, indentX: Math.min.apply(null, paras.map(function (p) { return p.x; })) };
  }

  /* ---------------- stage 3: classify + render */
  var slug = function (s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); };
  var runsHtml = function (runs) {
    return runs.map(function (r) { return r.b ? "<b>" + esc(r.s) + "</b>" : esc(r.s); }).join("");
  };
  var italicParens = function (html) { return html.replace(/\([^()<>]{1,60}\)/g, '<span class="sp-paren-inline"><i>$&</i></span>'); };

  function build(model) {
    var paras = model.paras, html = [], toc = [], scenes = [], part = null, inTitle = true, words = 0;
    paras.forEach(function (p, i) {
      words += p.text.split(/\s+/).length;
      var text = p.text;
      if (p.huge) {
        html.push('<header class="sp-title"><h2 class="visually-hidden">Title page</h2><p style="font-weight:700;font-size:1.6rem;text-transform:uppercase;letter-spacing:.04em">' + esc(text) + "</p>");
        return;
      }
      if (inTitle && !p.big) { html.push("<p>" + esc(text) + "</p>"); return; }
      if (inTitle) { html.push("</header>"); inTitle = false; }

      if (p.big) {
        var id = "part-" + slug(text);
        var front = !/^(Act|Midpoint)\b/.test(text) && !toc.length;
        part = { id: id, title: text, scenes: [], front: front };
        toc.push(part);
        html.push('<h2 class="sp-part' + (front ? " sp-part--front" : "") + '" id="' + id + '">' + esc(text) + "</h2>");
        return;
      }
      var m = text.match(SCENE_RE);
      if (m && p.allBold) {
        var sid = "scene-" + m[1];
        scenes.push(+m[1]);
        if (part) part.scenes.push({ id: sid, n: m[1], title: text.replace(/^\d+\.\s+/, "") });
        html.push('<h3 class="sp-scene" id="' + sid + '">' + esc(text) + "</h3>");
        return;
      }
      if (TRANS_RE.test(text)) {
        html.push('<p class="sp-trans' + (/^FADE IN/.test(text) ? " sp-trans--in" : "") + '">' + esc(text) + "</p>");
        return;
      }
      var first = p.runs[0];
      var lead = first && first.b ? first.s.trim() : "";
      if (lead && CUE_RE.test(lead) && !LABEL_WORDS.test(lead) && p.runs.length > 1) {
        var rest = p.runs.slice(1);
        html.push('<p class="sp-line"><span class="sp-cue">' + esc(lead.replace(/:$/, "")) + '</span><span class="visually-hidden">:</span> <span class="sp-speech">' + italicParens(runsHtml(rest).replace(/^\s+/, "")) + "</span></p>");
        return;
      }
      if (p.allBold && text.length < 70 && !/:$/.test(text)) {
        html.push('<h3 class="sp-front-h">' + esc(text) + "</h3>");
        return;
      }
      html.push('<p class="sp-action' + (p.x > model.indentX + 4 ? " sp-indent" : "") + '">' + runsHtml(p.runs) + "</p>");
    });
    if (inTitle) html.push("</header>");
    return { html: html.join("\n"), toc: toc, scenes: scenes, words: words };
  }

  function check(out) {
    // scene numbers must run 1..N with no gaps or repeats
    if (!out.scenes.length) return false;
    for (var i = 0; i < out.scenes.length; i++) if (out.scenes[i] !== i + 1) return false;
    return true;
  }

  function load() {
    var lib = window.pdfjsLib;
    if (!lib) return Promise.reject(new Error("pdf.js unavailable"));
    lib.GlobalWorkerOptions.workerSrc = WORKER;
    return lib.getDocument(PDF_URL).promise.then(function (doc) {
      var jobs = [];
      for (var i = 1; i <= doc.numPages; i++) jobs.push(doc.getPage(i).then(readPage));
      return Promise.all(jobs).then(function (pages) {
        var out = build(toParagraphs([].concat.apply([], pages)));
        out.pages = doc.numPages;
        window.__screenplay = out;   // handy for checking the conversion from the console
        return out;
      });
    });
  }

  /* ---------------- full reader page */
  function initReader() {
    var host = document.getElementById("script");
    if (!host) return;
    var status = document.getElementById("script-status");
    var fallback = function (why) {
      status.textContent = "";
      status.hidden = true;
      document.getElementById("script-fallback").hidden = false;
      document.getElementById("script-toc").closest("aside").hidden = true;
      if (window.console) console.warn("Screenplay reader fell back to PDF:", why);
    };
    load().then(function (out) {
      if (!check(out)) return fallback("scene numbering check failed");
      host.innerHTML = out.html;
      host.hidden = false;
      status.textContent = "Typeset from the original PDF: all " + out.pages + " pages, " + out.scenes.length + " scenes. Wording, order and emphasis are unchanged.";
      var tocEl = document.getElementById("script-toc");
      tocEl.innerHTML = out.toc.map(function (p) {
        return '<li class="' + (p.front ? "lvl-front" : "lvl-act") + '"><a href="#' + p.id + '">' + esc(p.title) + "</a>" +
          (p.scenes.length ? "<ol>" + p.scenes.map(function (s) {
            return '<li><a href="#' + s.id + '"><span class="sp-n">' + s.n + ".</span> " + esc(s.title.replace(/^(INT|EXT)\.\s*/, "").toLowerCase()) + "</a></li>";
          }).join("") + "</ol>" : "") + "</li>";
      }).join("");
      var det = document.getElementById("toc-details");
      if (window.innerWidth < 1024) det.open = false;
      tocEl.addEventListener("click", function (e) { if (e.target.closest("a") && window.innerWidth < 1024) det.open = false; });
      if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
      // highlight the current scene in the contents
      if ("IntersectionObserver" in window) {
        var links = {};
        Array.prototype.forEach.call(tocEl.querySelectorAll("a"), function (a) { links[a.getAttribute("href").slice(1)] = a; });
        var active = null;
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            var a = links[en.target.id]; if (!a) return;
            if (active) active.classList.remove("is-active");
            active = a; a.classList.add("is-active");
            if (window.innerWidth >= 1024) {
              var box = tocEl.closest(".script-toc"), r = a.getBoundingClientRect(), br = box.getBoundingClientRect();
              if (r.top < br.top || r.bottom > br.bottom) box.scrollTop += r.top - br.top - br.height / 3;
            }
          });
        }, { rootMargin: "0px 0px -75% 0px" });
        Array.prototype.forEach.call(host.querySelectorAll(".sp-part, .sp-scene"), function (h) { io.observe(h); });
      }
    }).catch(function (e) { fallback(e && e.message); });
  }

  /* ---------------- excerpts: <div data-screenplay-excerpt="1-1"> */
  function initExcerpts() {
    var els = document.querySelectorAll("[data-screenplay-excerpt]");
    if (!els.length) return;
    load().then(function (out) {
      if (!check(out)) throw new Error("check failed");
      var tmp = document.createElement("div");
      tmp.innerHTML = out.html;
      Array.prototype.forEach.call(els, function (el) {
        var r = el.getAttribute("data-screenplay-excerpt").split("-").map(Number);
        var start = tmp.querySelector("#scene-" + r[0]);
        if (!start) return;
        var frag = [], node = start;
        while (node) {
          if (node.classList && (node.classList.contains("sp-part") || (node.classList.contains("sp-scene") && +node.id.slice(6) > r[1]))) break;
          if (node.nodeType === 1) { var c = node.cloneNode(true); c.removeAttribute("id"); frag.push(c.outerHTML); }
          node = node.nextSibling;
        }
        el.innerHTML = frag.join("");
        el.removeAttribute("aria-busy");
      });
    }).catch(function () {
      Array.prototype.forEach.call(els, function (el) {
        el.innerHTML = '<p>This excerpt could not be loaded here. <a href="' + ROOT + 'read.html#everything-was-already-alive">Read the original PDF</a>.</p>';
      });
    });
  }

  initReader();
  initExcerpts();
})();
