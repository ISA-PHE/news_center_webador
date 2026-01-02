(function () {
  "use strict";

  // Read config from:
  // 1) script tag data attributes
  // 2) window.HBE_NEWS_BANNER_CONFIG
  // 3) sane defaults
  const currentScript = document.currentScript;

  const scriptCfg = {
    target: currentScript && currentScript.dataset ? currentScript.dataset.target : null,
    feed: currentScript && currentScript.dataset ? currentScript.dataset.feed : null,
    moreUrl: currentScript && currentScript.dataset ? currentScript.dataset.moreUrl : null,
    rolesUrl: currentScript && currentScript.dataset ? currentScript.dataset.rolesUrl : null
  };

  const globalCfg = (typeof window !== "undefined" && window.HBE_NEWS_BANNER_CONFIG)
    ? window.HBE_NEWS_BANNER_CONFIG
    : {};

  const CFG = {
    // Where to render
    targetId: scriptCfg.target || globalCfg.targetId || "hbe-news-banner",

    // Where to fetch content from (make this a stable URL, ideally GitHub Pages)
    feedUrl: scriptCfg.feed || globalCfg.feedUrl || "",

    // Buttons
    moreUrl: scriptCfg.moreUrl || globalCfg.moreUrl || "/news",
    rolesUrl: scriptCfg.rolesUrl || globalCfg.rolesUrl || "/roles",

    // Behavior
    maxItems: Number(globalCfg.maxItems || 8),
    speedPxPerSec: Number(globalCfg.speedPxPerSec || 55),
    openLinksInNewTab: Boolean(globalCfg.openLinksInNewTab || false),

    // Asset locations (auto detect based on this script src)
    assetsBaseUrl: (function () {
      if (!currentScript || !currentScript.src) return "";
      const src = currentScript.src;
      return src.slice(0, src.lastIndexOf("/") + 1);
    })()
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[c];
    });
  }

  function fmtDate(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
    } catch (e) {
      return "";
    }
  }

  function injectCss(url) {
  if (!url) return;

  const bust = (url.indexOf("?") >= 0 ? "&" : "?") + "v=" + Date.now();
  const finalUrl = url + bust;

  // Avoid double inject based on base url
  if (document.querySelector('link[data-hbe-banner="1"]')) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = finalUrl;
  link.setAttribute("data-hbe-banner", "1");
  document.head.appendChild(link);
  }

  function renderSkeleton(root) {
    root.innerHTML = [
      '<div class="hbe-newsbar" role="region" aria-label="Project Homebase Earth updates">',
      '  <div class="hbe-newsbar__inner">',
      '    <div class="hbe-newsbar__label" aria-hidden="true">Latest</div>',
      '    <div class="hbe-newsbar__ticker" aria-live="polite">',
      '      <div class="hbe-newsbar__track" id="' + CFG.targetId + '__track">',
      '        <span class="hbe-newsbar__loading">Loading updates…</span>',
      "      </div>",
      "    </div>",
      '    <div class="hbe-newsbar__actions">',
      '      <a class="hbe-newsbar__btn hbe-newsbar__btn--ghost" href="' + escapeHtml(CFG.moreUrl) + '">All updates</a>',
      '      <a class="hbe-newsbar__btn hbe-newsbar__btn--primary" href="' + escapeHtml(CFG.rolesUrl) + '">Roles</a>',
      "    </div>",
      "  </div>",
      "</div>"
    ].join("\n");
  }

  function buildItemNode(item) {
    const a = document.createElement("a");
    a.className = "hbe-newsbar__item";
    a.href = item.url || "#";

    const shouldNewTab = (typeof item.newTab === "boolean") ? item.newTab : CFG.openLinksInNewTab;
    if (shouldNewTab) {
      a.target = "_blank";
      a.rel = "noopener noreferrer nofollow";
    } else {
      a.target = "_self";
      a.rel = "nofollow";
    }

    const pill = document.createElement("span");
    pill.className = "hbe-newsbar__pill";
    pill.textContent = (item.type || "Update").toUpperCase();

    const title = document.createElement("span");
    title.className = "hbe-newsbar__title";
    title.textContent = item.title || "Untitled";

    a.appendChild(pill);
    a.appendChild(title);

    const dateText = fmtDate(item.date);
    if (dateText) {
      const date = document.createElement("span");
      date.className = "hbe-newsbar__date";
      date.textContent = dateText;
      a.appendChild(date);
    }

    return a;
  }

  function startTicker(track, speedPxPerSec) {
    const state = { x: 0, paused: false, raf: null, lastTs: null };

    function tick(ts) {
      if (!state.lastTs) state.lastTs = ts;
      const dt = (ts - state.lastTs) / 1000;
      state.lastTs = ts;

      if (!state.paused) {
        state.x -= speedPxPerSec * dt;
        const half = track.scrollWidth / 2;
        if (half > 0 && Math.abs(state.x) >= half) state.x = 0;
        track.style.transform = "translateX(" + state.x + "px)";
      }

      state.raf = requestAnimationFrame(tick);
    }

    // Pause on hover and focus
    const bar = track.closest(".hbe-newsbar");
    if (bar) {
      bar.addEventListener("mouseenter", function () { state.paused = true; });
      bar.addEventListener("mouseleave", function () { state.paused = false; });
      bar.addEventListener("focusin", function () { state.paused = true; });
      bar.addEventListener("focusout", function () { state.paused = false; });
    }

    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(tick);
  }

  async function fetchJson(url) {
    if (!url) throw new Error("No feedUrl configured.");

    // cache-buster helps with CDN and browser caching while keeping the URL stable
    const bust = (url.indexOf("?") >= 0 ? "&" : "?") + "cb=" + Date.now();

    const res = await fetch(url + bust, { cache: "no-store" });
    if (!res.ok) throw new Error("Feed fetch failed with status " + res.status);
    return await res.json();
  }

  function normalizeItems(items) {
    const arr = Array.isArray(items) ? items.slice() : [];
    // Sort newest first if date present
    arr.sort(function (a, b) {
      return new Date(b.date || 0) - new Date(a.date || 0);
    });
    return arr.slice(0, CFG.maxItems);
  }

  function renderItems(track, items) {
    track.innerHTML = "";

    if (!items.length) {
      const span = document.createElement("span");
      span.className = "hbe-newsbar__loading";
      span.textContent = "No updates published yet.";
      track.appendChild(span);
      return;
    }

    // Append twice for seamless loop
    const frag = document.createDocumentFragment();
    items.forEach(function (it) { frag.appendChild(buildItemNode(it)); });
    items.forEach(function (it) { frag.appendChild(buildItemNode(it)); });
    track.appendChild(frag);

    startTicker(track, CFG.speedPxPerSec);
  }

  async function boot() {
    const root = $(CFG.targetId);
    if (!root) return;

    injectCss();
    renderSkeleton(root);

    const track = $(CFG.targetId + "__track");
    if (!track) return;

    try {
      const data = await fetchJson(CFG.feedUrl);
      const items = normalizeItems(data.items);
      renderItems(track, items);
    } catch (e) {
      track.innerHTML = '<span class="hbe-newsbar__loading">Updates unavailable.</span>';
      // Keep console noise low in production, but still useful for debugging
      if (typeof console !== "undefined" && console.warn) console.warn("HBE banner load failed:", e);
    }
  }

  boot();
})();
