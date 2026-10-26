/* ------------------------------------------------------------------
   Shared behaviour: header + footer, mobile nav, audio players,
   small motion details. Every page sets <body data-root="…" data-page="…">.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var body = document.body;
  var ROOT = body.getAttribute("data-root") || "";
  var PAGE = body.getAttribute("data-page") || "";
  var SITE = window.SITE || {};
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var url = function (path) { return ROOT + path; };

  var NAV = [
    { id: "inquiry", label: "Inquiry", href: "inquiry/index.html", sub: [
      ["quant", "Quantitative Investing", "inquiry/quant.html"],
      ["deception", "Mathematics of Deception", "inquiry/deception.html"],
      ["observatory", "Market Observatory", "inquiry/observatory.html"],
      ["inflation", "Inflation Research", "inquiry/inflation.html"],
      ["upi", "UPI and Behaviour", "inquiry/upi.html"],
      ["journal", "Market Journal", "inquiry/journal.html"] ] },
    { id: "expression", label: "Expression", href: "expression/index.html", sub: [
      ["poetry", "Poetry", "expression/poetry.html"],
      ["music", "Music", "expression/music.html"],
      ["anatomy", "The Anatomy of a Sound", "expression/anatomy.html"],
      ["film", "Film and Screenwriting", "expression/film.html"] ] },
    { id: "projects", label: "Projects", href: "projects.html" },
    { id: "about", label: "About", href: "about.html" }
  ];
  var SECTION = body.getAttribute("data-section") || PAGE;

  /* ------------------------------------------------ header */
  function renderHeader() {
    var el = document.getElementById("site-header");
    if (!el) return;
    var items = NAV.map(function (n) {
      var current = n.id === SECTION ? ' aria-current="' + (n.id === PAGE ? "page" : "true") + '"' : "";
      var sub = n.sub ? '<ul class="nav__sub">' + n.sub.map(function (s) {
        return '<li><a href="' + url(s[2]) + '"' + (s[0] === PAGE ? ' aria-current="page"' : "") + ">" + esc(s[1]) + "</a></li>";
      }).join("") + "</ul>" : "";
      return '<li><a href="' + url(n.href) + '"' + current + ">" + n.label + "</a>" + sub + "</li>";
    }).join("");
    var mark = (SITE.owner && SITE.owner.wordmark) || "portfolio";
    el.innerHTML =
      '<div class="wrap">' +
        '<a class="wordmark" href="' + url("index.html") + '"' + (PAGE === "home" ? ' aria-current="page"' : "") + '><span class="wordmark__mark" aria-hidden="true"></span>' + esc(mark) + "</a>" +
        '<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span class="nav-toggle__icon" aria-hidden="true"></span><span class="nav-toggle__text">Menu</span></button>' +
        '<nav class="nav" id="site-nav" aria-label="Main"><ul>' + items + "</ul></nav>" +
      "</div>";

    var toggle = el.querySelector(".nav-toggle");
    var nav = el.querySelector(".nav");
    var setOpen = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.querySelector(".nav-toggle__text").textContent = open ? "Close" : "Menu";
      nav.classList.toggle("is-open", open);
      body.classList.toggle("nav-open", open);
    };
    toggle.addEventListener("click", function () { setOpen(toggle.getAttribute("aria-expanded") !== "true"); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) { setOpen(false); toggle.focus(); }
    });
    window.addEventListener("resize", function () { if (window.innerWidth >= 768) setOpen(false); });

    var onScroll = function () { el.classList.toggle("is-scrolled", window.scrollY > 8); };
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }

  /* ------------------------------------------------ footer */
  function renderFooter() {
    var el = document.getElementById("site-footer");
    if (!el) return;
    var contacts = (SITE.contact || []).filter(function (c) { return c.href; });
    var contactHtml = contacts.length
      ? contacts.map(function (c) { return '<li><a href="' + esc(c.href) + '" rel="noopener">' + esc(c.label) + "</a></li>"; }).join("")
      : "";
    el.innerHTML =
      '<div class="wrap">' +
        '<div><p style="font-family:var(--serif);font-size:1.25rem;color:var(--ink);margin-bottom:.4rem">' + esc((SITE.owner && SITE.owner.wordmark) || "") + "</p>" +
        "<p>Notes, numbers, sounds and a screenplay. Everything here is my own work unless stated otherwise.</p></div>" +
        '<div><h2>Index</h2><ul>' +
          '<li><a href="' + url("inquiry/index.html") + '">Inquiry</a></li>' +
          '<li><a href="' + url("expression/index.html") + '">Expression</a></li>' +
          '<li><a href="' + url("projects.html") + '">All projects</a></li>' +
          '<li><a href="' + url("about.html") + '">About</a></li></ul></div>' +
        (contactHtml ? '<div><h2>Elsewhere</h2><ul>' + contactHtml + '</ul></div>' : '') +
      "</div>";
  }

  /* ------------------------------------------------ audio player
     <div class="player" data-src="…" data-title="…"></div>
     A native <audio> element drives a small custom control. No autoplay. */
  var ICON_PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/></svg>';
  var players = [];
  var fmt = function (s) {
    if (!isFinite(s) || s < 0) return "–:––";
    s = Math.round(s);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  };

  function initPlayer(el) {
    var src = el.getAttribute("data-src");
    var title = el.getAttribute("data-title") || "recording";
    var known = el.getAttribute("data-duration") || "";
    var audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = src;
    el.innerHTML =
      '<button class="player__btn" type="button" aria-label="Play ' + esc(title) + '">' + ICON_PLAY + "</button>" +
      '<div class="player__track"><input class="player__range" type="range" min="0" max="1000" value="0" step="1" aria-label="Seek in ' + esc(title) + '" aria-valuetext="0:00"></div>' +
      '<span class="player__time"><span class="cur">0:00</span> / <span class="dur">' + esc(known || "–:––") + "</span></span>";
    el.appendChild(audio);
    var btn = el.querySelector(".player__btn");
    var range = el.querySelector(".player__range");
    var cur = el.querySelector(".cur");
    var dur = el.querySelector(".dur");
    var seeking = false;

    var paint = function () {
      var d = audio.duration, t = audio.currentTime;
      var p = d ? (t / d) * 100 : 0;
      if (!seeking) range.value = String(Math.round(p * 10));
      range.style.setProperty("--p", p + "%");
      cur.textContent = fmt(t);
      range.setAttribute("aria-valuetext", fmt(t) + " of " + fmt(d));
    };
    var setBtn = function (playing) {
      btn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
      btn.setAttribute("aria-label", (playing ? "Pause " : "Play ") + title);
    };
    btn.addEventListener("click", function () {
      if (audio.paused) {
        players.forEach(function (a) { if (a !== audio) a.pause(); });
        var pr = audio.play();
        if (pr && pr.catch) pr.catch(function () { el.classList.add("is-error"); });
      } else audio.pause();
    });
    audio.addEventListener("play", function () { setBtn(true); });
    audio.addEventListener("pause", function () { setBtn(false); });
    audio.addEventListener("ended", function () { setBtn(false); });
    audio.addEventListener("timeupdate", paint);
    audio.addEventListener("loadedmetadata", function () { if (isFinite(audio.duration)) dur.textContent = fmt(audio.duration); paint(); });
    audio.addEventListener("error", function () {
      dur.textContent = "unavailable";
      btn.disabled = true;
      btn.setAttribute("aria-label", title + " could not be loaded");
    });
    range.addEventListener("input", function () {
      seeking = true;
      if (audio.duration) {
        var t = (range.value / 1000) * audio.duration;
        cur.textContent = fmt(t);
        range.style.setProperty("--p", range.value / 10 + "%");
      }
    });
    range.addEventListener("change", function () {
      if (audio.duration) audio.currentTime = (range.value / 1000) * audio.duration;
      seeking = false;
    });
    players.push(audio);
  }
  function initPlayers(scope) {
    Array.prototype.forEach.call((scope || document).querySelectorAll(".player[data-src]"), function (el) {
      if (!el.querySelector("audio")) initPlayer(el);
    });
  }

  /* ------------------------------------------------ gentle reveal */
  function initReveal() {
    var els = document.querySelectorAll(".fade-in");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(els, function (e) { e.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    Array.prototype.forEach.call(els, function (e) { io.observe(e); });
  }

  /* ------------------------------------------------ in-page table of contents highlighting */
  function initToc() {
    var links = document.querySelectorAll(".toc a[href^='#']");
    if (!links.length || !("IntersectionObserver" in window)) return;
    var map = {};
    Array.prototype.forEach.call(links, function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          Array.prototype.forEach.call(links, function (a) { a.classList.remove("is-active"); });
          var a = map[en.target.id]; if (a) a.classList.add("is-active");
        }
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    Object.keys(map).forEach(function (id) { var t = document.getElementById(id); if (t) io.observe(t); });
  }

  renderHeader();
  renderFooter();

  window.Site = { esc: esc, url: url, doc: function (id) { return url("read.html#" + id); }, fmtTime: fmt, initPlayers: initPlayers, reduceMotion: reduceMotion };

  document.addEventListener("DOMContentLoaded", function () {
    initPlayers();
    initReveal();
    initToc();
  });
})();
