(function () {
  "use strict";

  const script = document.currentScript;

  function getAttr(name, fallback) {
    const v = script && script.dataset ? script.dataset[name] : "";
    return v ? v : fallback;
  }

  const FEED_URL = getAttr("feed", "");
  const TRACK_ID = getAttr("trackId", "hbeNewsTrack");
  const ROOT_ID = getAttr("rootId", "hbe-newsbar");
  const MAX_ITEMS = Number(getAttr("maxItems", "8"));
  const SPEED = Number(getAttr("speed", "55"));

  const track = document.getElementById(TRACK_ID);
  const bar = document.getElementById(ROOT_ID);

  if (!track) return;

  const state = {
    items: [],
    speedPxPerSec: Number.isFinite(SPEED) ? SPEED : 55,
    raf: null,
    x: 0,
    paused: false
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
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

  function buildNode(item) {
    const a = document.createElement("a");
    a.className = "hbe-newsbar__item";
    a.href = item.url || "#";

    // Default behavior: stay on-site unless item explicitly requests a new tab
    const newTab = typeof item.newTab === "boolean" ? item.newTab : false;
    if (newTab) {
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
    title.innerHTML = escapeHtml(item.title || "Untitled");

    a.appendChild(pill);
    a.appendChild(title);

    const dateText = item.date ? fmtDate(item.date) : "";
    if (dateText) {
      const date = document.createElement("span");
      date.className = "hbe-newsbar__date";
      date.textContent = dateText;
      a.appendChild(date);
    }

    return a;
  }

  function render(items) {
    track.innerHTML = "";
    const fragment = document.createDocumentFragment();

    items.forEach(function (it) {
      fragment.appendChild(buildNode(it));
    });

    // Duplicate for seamless loop
    items.forEach(function (it) {
      fragment.appendChild(buildNode(it));
    });

    track.appendChild(fragment);

    state.x = 0;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(tick);
  }

  function tick(ts) {
    if (state.paused) {
      state.raf = requestAnimationFrame(tick);
      return;
    }

    const dt = (tick.lastTs ? (ts - tick.lastTs) : 16) / 1000;
    tick.lastTs = ts;

    state.x -= state.speedPxPerSec * dt;

    const halfWidth = track.scrollWidth / 2;
    if (halfWidth > 0 && Math.abs(state.x) >= halfWidth) {
      state.x = 0;
    }

    track.style.transform = "translateX(" + state.x + "px)";
    state.raf = requestAnimationFrame(tick);
  }

  async function load() {
    try {
      if (!FEED_URL) throw new Error("Missing feed URL");

      // Strong cache bust to avoid stale JSON from any layer
      const url = FEED_URL + (FEED_URL.indexOf("?") >= 0 ? "&" : "?") + "cb=" + Date.now();

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Feed fetch failed: " + res.status);

      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];

      items.sort(function (a, b) {
        return new Date(b.date || 0) - new Date(a.date || 0);
      });

      state.items = items.slice(0, Number.isFinite(MAX_ITEMS) ? MAX_ITEMS : 8);

      if (!state.items.length) {
        track.innerHTML = "<span class='hbe-newsbar__loading'>No update
