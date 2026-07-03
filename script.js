/* =====================================================================
   THE SOVEREIGN ARCHITECT — script.js
   Vanilla JS, no dependencies. Organized as independent init functions
   called once on DOMContentLoaded.
   ===================================================================== */

(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* -------------------------------------------------------------------
     Utilities
     ------------------------------------------------------------------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function formatPeso(n) {
    var rounded = Math.round(n);
    return "\u20B1" + rounded.toLocaleString("en-US");
  }

  function formatPesoShort(n) {
    if (n >= 1000000) {
      var m = n / 1000000;
      return "\u20B1" + (Number.isInteger(m) ? m.toString() : m.toFixed(1)) + "M";
    }
    if (n >= 1000) return "\u20B1" + Math.round(n / 1000) + "K";
    return "\u20B1" + Math.round(n);
  }

  function clampNum(raw, min, max, fallback) {
    var n = parseFloat(raw);
    if (isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  /* -------------------------------------------------------------------
     Reveal on scroll — fade + lift, once per element
     ------------------------------------------------------------------- */
  function initReveal() {
    var items = $all(".reveal");
    if (!items.length) return;

    if (prefersReducedMotion) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });

    items.forEach(function (el) { observer.observe(el); });
  }

  /* -------------------------------------------------------------------
     Scroll-spy — highlight the active sheet in the rail
     ------------------------------------------------------------------- */
  function initScrollSpy() {
    var sheets = $all(".sheet");
    var links = $all(".rail__link");
    if (!sheets.length || !links.length) return;

    var linkMap = {};
    links.forEach(function (link) { linkMap[link.dataset.sheet] = link; });

    var railCurrent = $("#railCurrent");
    var current = "a0";

    function paint() {
      links.forEach(function (link) {
        var active = link.dataset.sheet === current;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
      if (railCurrent && linkMap[current]) {
        var num = linkMap[current].querySelector(".rail__num").textContent;
        var name = linkMap[current].querySelector(".rail__name").textContent;
        railCurrent.textContent = num + " \u00B7 " + name;
      }
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) current = entry.target.dataset.sheet;
      });
      paint();
    }, { rootMargin: "-35% 0px -55% 0px", threshold: 0 });

    sheets.forEach(function (s) { observer.observe(s); });
    paint();
  }

  /* -------------------------------------------------------------------
     Mobile rail drawer toggle
     ------------------------------------------------------------------- */
  function initRailToggle() {
    var toggle = $("#railToggle");
    var rail = $(".rail");
    if (!toggle || !rail) return;

    function close() {
      rail.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
    function open() {
      rail.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
    }

    toggle.addEventListener("click", function () {
      var isOpen = rail.classList.contains("is-open");
      if (isOpen) close(); else open();
    });

    $all(".rail__link").forEach(function (link) {
      link.addEventListener("click", close);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && rail.classList.contains("is-open")) {
        close();
        toggle.focus();
      }
    });
  }

  /* -------------------------------------------------------------------
     Scroll progress ruler
     ------------------------------------------------------------------- */
  function initRuler() {
    var fill = $("#rulerFill");
    if (!fill) return;
    var ticking = false;

    function update() {
      var scrollTop = window.scrollY || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? Math.min(1, Math.max(0, scrollTop / docHeight)) : 0;
      fill.style.height = (progress * 100) + "%";
      ticking = false;
    }

    window.addEventListener("scroll", function () {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });

    update();
  }

  /* -------------------------------------------------------------------
     Cover sheet — draft-in animation (frame line), once on load
     ------------------------------------------------------------------- */
  function initCoverFrame() {
    var rect = $(".cover-frame__rect");
    if (!rect) return;

    if (prefersReducedMotion) {
      rect.style.strokeDasharray = "none";
      rect.style.strokeDashoffset = "0";
      return;
    }

    var len = 0;
    try { len = rect.getTotalLength(); } catch (e) { len = 800; }
    rect.style.strokeDasharray = String(len);
    rect.style.strokeDashoffset = String(len);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        rect.style.transition = "stroke-dashoffset 1.7s " + "cubic-bezier(0.22,0.61,0.36,1)";
        rect.style.strokeDashoffset = "0";
      });
    });
  }

  /* -------------------------------------------------------------------
     Scripture / quote callout reflections — collapsible detail notes
     ------------------------------------------------------------------- */
  function initCallouts() {
    $all(".callout__toggle").forEach(function (btn) {
      var targetId = btn.getAttribute("aria-controls");
      var target = document.getElementById(targetId);
      if (!target) return;
      target.setAttribute("aria-hidden", "true");

      btn.addEventListener("click", function () {
        var isOpen = target.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
        if (isOpen) target.removeAttribute("aria-hidden");
        else target.setAttribute("aria-hidden", "true");
        btn.textContent = isOpen ? "Hide the reflection" : "Read the reflection";
      });
    });
  }

  /* -------------------------------------------------------------------
     Phase Progress Tracker — tri-state, persisted via localStorage
     ------------------------------------------------------------------- */
  var PROGRESS_KEY = "sovereign-architect-phase-progress-v1";
  var DEFAULT_PROGRESS = {
    "1": "completed",
    "2": "not-started",
    "3": "not-started",
    "4": "not-started",
    "5": "not-started",
    "6": "not-started",
    "7": "not-started"
  };

  function loadProgress() {
    try {
      var raw = window.localStorage.getItem(PROGRESS_KEY);
      if (!raw) return Object.assign({}, DEFAULT_PROGRESS);
      var parsed = JSON.parse(raw);
      return Object.assign({}, DEFAULT_PROGRESS, parsed);
    } catch (e) {
      return Object.assign({}, DEFAULT_PROGRESS);
    }
  }

  function saveProgress(state) {
    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(state));
    } catch (e) {
      /* localStorage unavailable (private mode, quota) -- still works for this visit */
    }
  }

  function initProgressTracker() {
    var controls = $all(".progress-control");
    if (!controls.length) return;
    var state = loadProgress();

    function paint(control, animateStamp) {
      var phase = control.dataset.phase;
      var value = state[phase] || "not-started";
      control.dataset.state = value;
      $all('input[type="radio"]', control).forEach(function (r) {
        r.checked = r.value === value;
      });
      var stamp = $(".stamp", control);
      if (stamp) {
        if (value === "completed") {
          stamp.classList.add("is-visible");
          if (animateStamp && !prefersReducedMotion) {
            stamp.classList.remove("stamp--play");
            void stamp.offsetWidth; /* reflow so the animation can restart */
            stamp.classList.add("stamp--play");
          }
        } else {
          stamp.classList.remove("is-visible", "stamp--play");
        }
      }
    }

    controls.forEach(function (control) {
      paint(control, false);
      control.addEventListener("change", function (e) {
        if (e.target.type !== "radio") return;
        var phase = control.dataset.phase;
        state[phase] = e.target.value;
        saveProgress(state);
        paint(control, true);
      });
    });
  }

  /* -------------------------------------------------------------------
     Savings chart (Sheet A6) + live "try your own numbers" calculator
     ------------------------------------------------------------------- */
  function initSavingsChart() {
    var svg = document.getElementById("savingsChartSvg");
    var container = document.getElementById("savingsChart");
    if (!svg || !container) return;

    var NS = "http://www.w3.org/2000/svg";
    var plot = { left: 68, right: 610, top: 20, bottom: 296 };

    var realData = [
      { label: "Year 1", value: 878700 },
      { label: "Year 2", value: 1992300 },
      { label: "Year 3", value: 3593100 },
      { label: "Year 4", value: 5820300 },
      { label: "Year 5", value: 8691300 },
      { label: "+ Bonuses", value: 10076050 }
    ];

    var salaryInput = document.getElementById("calcSalary");
    var rateInput = document.getElementById("calcRate");
    var yearsInput = document.getElementById("calcYears");
    var resultValueEl = document.getElementById("calcResultValue");
    var resultYearsEl = document.getElementById("calcResultYears");
    var monthlyEl = document.getElementById("calcMonthly");

    var revealed = false;

    function niceMax(value) {
      if (value <= 0) return 1000000;
      var magnitude = Math.pow(10, Math.floor(Math.log10(value)));
      var step = magnitude / 2;
      return Math.ceil(value / step) * step;
    }

    function buildScale(pointCount, yMax) {
      var xStep = (plot.right - plot.left) / (pointCount - 1);
      return {
        x: function (i) { return plot.left + i * xStep; },
        y: function (v) { return plot.bottom - (Math.min(v, yMax) / yMax) * (plot.bottom - plot.top); }
      };
    }

    function pathFromPoints(points) {
      return points.map(function (p, i) {
        return (i === 0 ? "M" : "L") + p.x.toFixed(1) + "," + p.y.toFixed(1);
      }).join(" ");
    }

    function svgEl(tag, attrs) {
      var node = document.createElementNS(NS, tag);
      for (var k in attrs) node.setAttribute(k, attrs[k]);
      return node;
    }

    function render() {
      if (!salaryInput || !rateInput || !yearsInput) return;

      var salary = clampNum(salaryInput.value, 10000, 500000, 94250);
      var rate = clampNum(rateInput.value, 0, 100, 78);
      var years = Math.round(clampNum(yearsInput.value, 1, 10, 5));

      var monthlySavings = salary * (rate / 100);
      var projData = [];
      for (var y = 0; y <= years; y++) projData.push(monthlySavings * 12 * y);

      var pointCount = Math.max(realData.length, years + 1);
      var realMax = realData[realData.length - 1].value;
      var projMax = projData[projData.length - 1];
      var yMax = niceMax(Math.max(realMax, projMax, 1000000));

      var scale = buildScale(pointCount, yMax);

      while (svg.firstChild) svg.removeChild(svg.firstChild);

      var titleNode = svgEl("title", { id: "chartTitle" });
      titleNode.textContent = "Projected cumulative savings growth in Saudi Arabia, five-year direct IT entry";
      svg.appendChild(titleNode);

      var gridSteps = 5, i, v, yy;
      for (i = 0; i <= gridSteps; i++) {
        v = (yMax / gridSteps) * i;
        yy = scale.y(v);
        svg.appendChild(svgEl("line", { x1: plot.left, x2: plot.right, y1: yy, y2: yy, "class": "chart__gridline" }));
        var yLabel = svgEl("text", { x: plot.left - 10, y: yy + 3.5, "class": "chart__axis-label chart__axis-label--y" });
        yLabel.textContent = formatPesoShort(v);
        svg.appendChild(yLabel);
      }

      for (var xi = 0; xi < pointCount; xi++) {
        var xx = scale.x(xi);
        var xLabel = svgEl("text", {
          x: xx, y: plot.bottom + 22,
          "class": "chart__axis-label chart__axis-label--x",
          "text-anchor": xi === 0 ? "start" : (xi === pointCount - 1 ? "end" : "middle")
        });
        xLabel.textContent = xi < realData.length ? realData[xi].label : ("Y" + xi);
        svg.appendChild(xLabel);
      }

      var realPoints = realData.map(function (d, idx) { return { x: scale.x(idx), y: scale.y(d.value) }; });
      var realPath = svgEl("path", { d: pathFromPoints(realPoints), "class": "chart__line chart__line--real", id: "realChartPath" });
      svg.appendChild(realPath);

      realPoints.forEach(function (p, idx) {
        var isFinal = idx === realPoints.length - 1;
        svg.appendChild(svgEl("circle", {
          cx: p.x, cy: p.y, r: isFinal ? 5 : 4,
          "class": "chart__point chart__point--real" + (isFinal ? " chart__point--final" : "")
        }));
        var valueLabel = svgEl("text", {
          x: p.x, y: p.y - 12,
          "class": "chart__value-label",
          "text-anchor": isFinal ? "end" : "middle"
        });
        valueLabel.textContent = formatPeso(realData[idx].value);
        svg.appendChild(valueLabel);
      });

      if (years >= 1) {
        var projPoints = projData.map(function (val, idx) { return { x: scale.x(idx), y: scale.y(val) }; });
        svg.appendChild(svgEl("path", { d: pathFromPoints(projPoints), "class": "chart__line chart__line--projection" }));
        projPoints.forEach(function (p, idx) {
          if (idx === 0) return;
          svg.appendChild(svgEl("circle", { cx: p.x, cy: p.y, r: 3, "class": "chart__point chart__point--projection" }));
        });
      }

      if (prefersReducedMotion) {
        realPath.style.strokeDasharray = "none";
      } else if (revealed) {
        realPath.style.transition = "none";
        realPath.style.strokeDasharray = "none";
        realPath.style.strokeDashoffset = "0";
      } else {
        var len = realPath.getTotalLength();
        realPath.style.strokeDasharray = String(len);
        realPath.style.strokeDashoffset = String(len);
      }

      if (monthlyEl) monthlyEl.textContent = formatPeso(monthlySavings);
      if (resultYearsEl) resultYearsEl.textContent = String(years);
      if (resultValueEl) resultValueEl.textContent = formatPeso(monthlySavings * 12 * years);
    }

    render();

    [salaryInput, rateInput, yearsInput].forEach(function (input) {
      if (input) input.addEventListener("input", render);
    });

    if (!prefersReducedMotion) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !revealed) {
            revealed = true;
            var path = document.getElementById("realChartPath");
            if (path) {
              var len = path.getTotalLength();
              path.style.strokeDasharray = String(len);
              path.style.strokeDashoffset = String(len);
              requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                  path.style.transition = "stroke-dashoffset 1.8s cubic-bezier(0.22,0.61,0.36,1)";
                  path.style.strokeDashoffset = "0";
                });
              });
            }
            observer.disconnect();
          }
        });
      }, { threshold: 0.3 });
      observer.observe(container);
    } else {
      revealed = true;
    }
  }

  /* -------------------------------------------------------------------
     Read Mode — swaps to a light paper palette, persisted, prints clean
     ------------------------------------------------------------------- */
  var THEME_KEY = "sovereign-architect-theme";

  function initReadMode() {
    var btn = document.getElementById("readToggle");
    var label = document.getElementById("readToggleLabel");
    if (!btn) return;

    var saved = null;
    try { saved = window.localStorage.getItem(THEME_KEY); } catch (e) { saved = null; }

    function apply(isRead) {
      if (isRead) document.documentElement.setAttribute("data-theme", "read");
      else document.documentElement.removeAttribute("data-theme");
      btn.setAttribute("aria-pressed", isRead ? "true" : "false");
      if (label) label.textContent = isRead ? "Blueprint Mode" : "Read Mode";
    }

    apply(saved === "read");

    btn.addEventListener("click", function () {
      var isRead = document.documentElement.getAttribute("data-theme") === "read";
      var next = !isRead;
      apply(next);
      try { window.localStorage.setItem(THEME_KEY, next ? "read" : "blueprint"); } catch (e) { /* ignore */ }
    });
  }

  /* -------------------------------------------------------------------
     Ambient sound — optional, muted by default, never autoplays.
     A soft filtered noise wash generated with the Web Audio API, so no
     external audio file is needed. Only ever starts from a user click.
     ------------------------------------------------------------------- */
  function initAmbientSound() {
    var btn = document.getElementById("soundToggle");
    var label = document.getElementById("soundToggleLabel");
    if (!btn) return;

    var ctx = null;
    var gainNode = null;
    var playing = false;

    function buildNoise() {
      var bufferSize = 2 * ctx.sampleRate;
      var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      var lastOut = 0;
      for (var i = 0; i < bufferSize; i++) {
        var white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.5;
      }
      var source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      var filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 900;

      gainNode = ctx.createGain();
      gainNode.gain.value = 0;

      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
    }

    btn.addEventListener("click", function () {
      if (!ctx) {
        try {
          ctx = new (window.AudioContext || window.webkitAudioContext)();
          buildNoise();
        } catch (e) {
          btn.disabled = true;
          return;
        }
      }
      if (ctx.state === "suspended") ctx.resume();

      playing = !playing;
      var now = ctx.currentTime;
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setTargetAtTime(playing ? 0.05 : 0, now, 0.4);

      btn.setAttribute("aria-pressed", playing ? "true" : "false");
      if (label) label.textContent = playing ? "Mute Ambient Sound" : "Play Ambient Sound";
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initReveal();
    initScrollSpy();
    initRailToggle();
    initRuler();
    initCoverFrame();
    initCallouts();
    initProgressTracker();
    initSavingsChart();
    initReadMode();
    initAmbientSound();
  });
})();
