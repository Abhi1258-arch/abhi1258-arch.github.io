/* ------------------------------------------------------------------
   "Question the watchman": a playable version of the paper's model.
   Same question bank (P(yes | lie), P(yes | truth)), same Bayes update,
   entropy and expected information gain as the paper's deception.py.
   The spoken question wording is only a way to present each clue; the
   clue itself ("watching for") is the paper's.
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  // [ask, watching for (paper), sentence if yes, sentence if no, P(yes | lie), P(yes | truth)]
  var Q = [
    ["Walk me through your last round.", "Consistent account of last round", "His account of the last round is consistent.", "His account of the last round doesn’t hold together.", .40, .80],
    ["Did you hear the alarm?", "Hesitates when asked about the alarm", "He hesitates before answering.", "He answers straight away.", .60, .20],
    ["What time did you last check the east wing?", "Contradicts his earlier timing", "The time contradicts what he said earlier.", "The time matches what he said earlier.", .50, .10],
    ["Where were the keys all night?", "Consistent account of the keys", "His account of the keys is consistent.", "His account of the keys doesn’t add up.", .45, .75],
    ["When did you take your break?", "Gives an unusually precise time", "He gives an unusually precise time.", "He gives a rough time.", .35, .15],
    ["Where were you at two in the morning?", "Asks why we want to know", "He asks why you want to know.", "He just answers.", .55, .45],
    ["Describe the security monitors in the east wing.", "Can describe the monitor layout", "He describes the monitor layout correctly.", "He can’t describe the monitor layout.", .30, .90],
    ["Tell me the whole night again, from the start.", "Changes a detail when retelling", "He changes a detail the second time.", "His retelling matches the first time.", .65, .35],
    ["How was the night?", "Mentions the weather", "He mentions the weather.", "He doesn’t mention the weather.", .50, .50],
    ["Can anyone confirm you were there?", "Names a colleague who can confirm", "He names a colleague who can confirm.", "He can’t name anyone.", .35, .60]
  ];
  var H = function (p) { return p <= 0 || p >= 1 ? 0 : -p * Math.log2(p) - (1 - p) * Math.log2(1 - p); };
  var upd = function (p, a, b, yes) { var l = yes ? a : 1 - a, t = yes ? b : 1 - b; return l * p / (l * p + t * (1 - p)); };
  var eig = function (p, a, b) { var py = a * p + b * (1 - p); return H(p) - (py * H(upd(p, a, b, true)) + (1 - py) * H(upd(p, a, b, false))); };
  var strength = function (g) { return g >= .15 ? ["Strong clue", 4] : g >= .06 ? ["Useful", 3] : g >= .02 ? ["Weak", 2] : g > .001 ? ["Barely helps", 1] : ["Tells you nothing", 0]; };
  var pc = function (v) { return Math.round(v * 100) + "%"; };

  var el = document.getElementById("lab");
  var S, auto = null;
  function newCase() { if (auto) { clearTimeout(auto); auto = null; } S = { lie: Math.random() < 0.5, p: 0.5, asked: [], verdict: null, byAlgorithm: false }; }

  function ask(i) {
    var q = Q[i], yes = Math.random() < (S.lie ? q[4] : q[5]), before = S.p;
    S.p = upd(S.p, q[4], q[5], yes);
    S.asked.push({ i: i, yes: yes, before: before, after: S.p });
  }
  function decide(saysLie) { S.verdict = saysLie; if (auto) { clearTimeout(auto); auto = null; } }

  function render() {
    var p = S.p, over = S.verdict !== null;
    var left = Q.map(function (q, i) { return i; }).filter(function (i) { return !S.asked.some(function (x) { return x.i === i; }); });
    var gains = {}; left.forEach(function (i) { gains[i] = eig(p, Q[i][4], Q[i][5]); });
    var best = left.reduce(function (b, i) { return b === null || gains[i] > gains[b] ? i : b; }, null);
    var confident = p >= .9 ? "You can be 90% sure he’s lying." : p <= .1 ? "You can be 90% sure he’s telling the truth." : "";
    var lean = p > .5 ? "leaning: lying" : p < .5 ? "leaning: truthful" : "no idea yet";

    var html =
      '<div class="lab__meter">' +
        '<div class="lab__row"><span>Chance he’s lying <span class="muted small">(' + lean + ")</span></span><strong>" + pc(p) + "</strong></div>" +
        '<div class="lab__bar" role="img" aria-label="Chance he is lying: ' + pc(p) + '"><span style="width:' + (p * 100) + '%"></span><i style="left:10%"></i><i style="left:90%"></i></div>' +
        '<div class="lab__row small muted"><span>Telling the truth</span><span>Uncertainty ' + H(p).toFixed(2) + " bits</span><span>Lying</span></div>" +
      "</div>";

    if (over) {
      var right = S.verdict === S.lie;
      html += '<div class="lab__reveal ' + (right ? "is-right" : "is-wrong") + '"><p><strong>' + (S.byAlgorithm ? "The algorithm says " : "You said ") + (S.verdict ? "lying" : "truthful") + ". " +
        (right ? "Correct" : "Wrong") + ": he was " + (S.lie ? "lying" : "telling the truth") + ".</strong></p><p class=\"small\">" +
        S.asked.length + " question" + (S.asked.length === 1 ? "" : "s") + " asked. In the paper’s simulation, the algorithm needed a median of 3 and was right 88% of the time; random questioning needed 7. " +
        (!right ? "Being wrong at 90% confidence happens: the clues are imperfect, so roughly 1 case in 10 still fools you." : "") + "</p></div>";
    } else if (confident) {
      html += '<p class="note"><strong>' + confident + "</strong> The paper’s algorithm would stop asking here and make its call.</p>";
    }

    if (!over) {
      html += '<p class="lab__label">' + (left.length ? "Ask him something" : "You’ve asked every question.") + "</p>" +
        '<div class="lab__qs">' + left.map(function (i) {
          var s = strength(gains[i]);
          return '<button type="button" class="lab__q' + (i === best ? " is-best" : "") + '" data-q="' + i + '">' +
            '<span class="lab__ask">' + (i === best ? '<span aria-label="Best next question">★ </span>' : "") + "“" + Q[i][0] + "”</span>" +
            '<span class="lab__watch">Watching for: ' + Q[i][1].toLowerCase() + "</span>" +
            '<span class="lab__str"><span class="lab__pips" aria-hidden="true">' + [1, 2, 3, 4].map(function (k) { return "<i" + (k <= s[1] ? ' class="on"' : "") + "></i>"; }).join("") + "</span>" + s[0] + "</span></button>";
        }).join("") + "</div>";
    }

    html += '<div class="actions">' +
      (!over ? '<button class="btn btn--solid" type="button" data-verdict="1"' + (S.asked.length ? "" : " disabled") + ">He’s lying</button>" +
               '<button class="btn btn--solid" type="button" data-verdict="0"' + (S.asked.length ? "" : " disabled") + ">He’s telling the truth</button>" : "") +
      '<button class="btn" type="button" data-new>' + (over ? "New case" : "Start over") + "</button>" +
      (!over && !S.asked.length ? '<button class="btn" type="button" data-auto>Watch the algorithm play</button>' : "") + "</div>";

    if (S.asked.length) {
      html += '<ol class="lab__log">' + S.asked.map(function (x) {
        var q = Q[x.i], ly = x.yes ? q[4] : 1 - q[4], ty = x.yes ? q[5] : 1 - q[5];
        var dir = x.after > x.before + 1e-9 ? "more likely a lie" : x.after < x.before - 1e-9 ? "less likely a lie" : "no change";
        return "<li><span class=\"muted\">“" + q[0] + "”</span><br><strong>" + (x.yes ? q[2] : q[3]) + "</strong><br>" +
          '<span class="small muted">Liars do this ' + pc(ly) + " of the time, honest people " + pc(ty) + ". So: " + dir + ", " + pc(x.before) + " → " + pc(x.after) + ".</span></li>";
      }).join("") + "</ol>";
    }
    el.innerHTML = html;
  }

  function algorithmStep() {
    var left = Q.map(function (q, i) { return i; }).filter(function (i) { return !S.asked.some(function (x) { return x.i === i; }); });
    if (S.p >= .9 || S.p <= .1 || !left.length) { S.byAlgorithm = true; decide(S.p > .5 ? true : S.p < .5 ? false : Math.random() < .5); render(); return; }
    var best = left.reduce(function (b, i) { return b === null || eig(S.p, Q[i][4], Q[i][5]) > eig(S.p, Q[b][4], Q[b][5]) ? i : b; }, null);
    ask(best); render();
    auto = setTimeout(algorithmStep, window.Site && window.Site.reduceMotion ? 300 : 1300);
  }

  el.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b || b.disabled) return;
    if (b.hasAttribute("data-new")) { newCase(); render(); return; }
    if (b.hasAttribute("data-auto")) { newCase(); auto = setTimeout(algorithmStep, 200); return; }
    if (b.hasAttribute("data-verdict")) { decide(b.getAttribute("data-verdict") === "1"); render(); return; }
    if (b.hasAttribute("data-q") && !auto) { ask(+b.getAttribute("data-q")); render(); }
  });

  newCase(); render();
  window.__deceptionGame = { state: function () { return S; }, Q: Q, upd: upd, eig: eig };   // for checking from the console
})();
