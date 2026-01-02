(function () {
  "use strict";

  const script = document.currentScript;

  function getAttr(name, fallback) {
    if (!script || !script.dataset) return fallback;
    const v = script.dataset[name];
    return (v === undefined || v === null || v === "") ? fallback : v;
  }

  const FEED_URL = getAttr("feed", "");
  const MAX_ITEMS = parseInt(getAttr("maxItems", "8"), 10);
  const SPEED = parseFloat(getAttr("speed", "55"));
  const TRACK_ID = getAttr("trackId", "hbeNewsTrack");
  const BAR_ID = getAttr("barId", "hbe-newsbar");

  const state = {
    items: [],
    speedPxPerSec: Number.isFinite(SPEED) ? SPEED : 55,
    raf: null,
    x: 0,
    paused: false,
    lastTs: null
  };

  function setStatus(track, msg) {
    if (!track) return;
    track.innerHTML = "<span class='hbe-newsbar__loading'>" + msg + "</span>";
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

  function buildNode(item) {
    const a = document.createElement("a");
    a.className = "hbe-newsbar__item";
    a.href = item.url || "#";
    a.target = item.target || "_self";
    a.rel = (a.target === "_blank") ? "noopener noreferrer nofollow" : "nofollow";

    const pill = document.createElement("span");
    pill.className = "hbe-newsbar__pill";
    pill.textContent = (item.type || "Update").toUpperCase();

    const title = document.createElement("span");
    title.textContent = item.title || "Untitled";

    const dateText = item.date ? fmtDate(item.date) : "";
    const date = document.createElement("span");
    date.className = "hbe-newsbar__date";
    date.textContent = dateText;

    a.appendChild(pill);
    a.appendChild(title);
    if (dateText) a.appendChild(date);

    return a;
  }

  function render(track, items) {
    track.innerHTML = "";
    const fragment = document.createDocumentFragment();

    items.forEach(function (it) { fragment.appendChild(buildNode(it)); });
    items.forEach(function (it) { fragment.appendChild(buildNode(it)); }); // duplicate for loop

    track.appendChild(fragment);

    state.x = 0;
    state.lastTs = null;

    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(function tick(ts) {
      if (!state.lastTs) state.lastTs = ts;
      const dt = (ts - state.lastTs) / 1000;
      state.lastTs = ts;

      if (!state.paused) {
        state.x -= state.speedPxPerSec * dt;

        const halfWidth = track.scrollWidth / 2;
        if (halfWidth > 0 && Math.abs(state.x) >= halfWidth) state.x = 0;

        track.style.transform = "translateX(" + state.x + "px)";
      }

      state.raf = requestAnimationFrame(tick);
    });
  }

  async function fetchJsonWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const t = setTimeout(function () { controller.abort(); }, timeoutMs);

    try {
      const bust = (url.indexOf("?") >= 0 ? "&" : "?") + "cb=" + Date.now();
      const res = await fetch(url + bust, { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  function sortAndSlice(items) {
    const arr = Array.isArray(items) ? items.slice() : [];
    arr.sort(function (a, b) {
      return new Date(b.date || 0) - new Date(a.date || 0);
    });
    const n = Number.isFinite(MAX_ITEMS) ? MAX_ITEMS : 8;
    return arr.slice(0, n);
  }

  async function boot() {
    // Wait until DOM is ready and elements exist
    const ready = (document.readyState === "loading")
      ? new Promise(function (r) { document.addEventListener("DOMContentLoaded", r, { once: true }); })
      : Promise.resolve();

    await ready;

    const track = document.getElementById(TRACK_ID);
    const bar = document.getElementById(BAR_ID);

    if (!track) return; // cannot render anywhere

    // If FEED_URL missing, fail clearly
    if (!FEED_URL) {
      setStatus(track, "Missing feed URL.");
      return;
    }

    // Hook pause events
    if (bar) {
      bar.addEventListener("mouseenter", function () { state.paused = true; });
      bar.addEventListener("mouseleave", function () { state.paused = false; });
      bar.addEventListener("focusin", function () { state.paused = true; });
      bar.addEventListener("focusout", function () { state.paused = false; });
    }

    // If fetch hangs or is blocked, do not stay on Loading forever
    try {
      const data = await fetchJsonWithTimeout(FEED_URL, 7000);
      const items = sortAndSlice(data.items);

      if (!items.length) {
        setStatus(track, "No updates published yet.");
        return;
      }

      render(track, items);
    } catch (e) {
      setStatus(track, "Updates unavailable. Please refresh.");
      if (typeof console !== "undefined" && console.warn) console.warn("HBE banner fetch failed:", e);
    }
  }

  boot();
})();
