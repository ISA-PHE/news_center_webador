(function () {
  var CONFIG = {
    guideId: "hbe-streams-list",

    youtubeChannelId: "UCUcLdMy2dnTMBpvKe_29a2g",

    rumbleProfileUrl: "https://rumble.com/user/project_homebase_earth",
    rumbleRssUrl: "https://openrss.org/feed/rumble.com/user/project_homebase_earth",

    // Manual fallback so Rumble shows even if RSS stays empty
    rumbleManualVideoUrl: "",            // put your real Rumble video URL here (optional)
    rumbleManualTitle: "Latest on Rumble",
    rumbleManualThumbnailUrl: "",        // optional
    rumbleManualDateISO: "",             // optional

    maxItems: 24
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function waitForElement(id, cb, tries) {
    tries = tries || 0;
    var el = byId(id);
    if (el) return cb(el);
    if (tries > 80) return;
    setTimeout(function () { waitForElement(id, cb, tries + 1); }, 100);
  }

  function write(el, html) {
    el.innerHTML = html;
  }

  function msg(el, text, error) {
    write(
      el,
      "<div style='padding:14px 16px;font-size:13px;line-height:1.45;color:" +
        (error ? "#8a1f1f" : "#666") +
        ";'>" +
        text +
        "</div>"
    );
  }

  function stripHtml(html) {
    if (!html) return "";
    var tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }

  function safeDate(d) {
    var dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  function rss2jsonUrl(feedUrl) {
    return "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(feedUrl);
  }

  function titleFallback(sourceLabel, title, link) {
    var t = (title || "").trim();
    if (t) return t;
    if (sourceLabel === "Rumble") return "Latest on Rumble";
    if (sourceLabel === "YouTube") return "Latest on YouTube";
    return link ? "Open video" : "Latest update";
  }

  function normalizeRssItems(items, sourceLabel) {
    if (!items || !items.length) return [];
    return items.map(function (it) {
      var dt = safeDate(it.pubDate) || safeDate(it.publishedDate) || new Date();
      var link = (it.link || "").trim();
      var thumb = it.thumbnail || (it.enclosure && it.enclosure.link) || "";
      var desc = stripHtml(it.description || "").trim();
      var title = titleFallback(sourceLabel, it.title, link);

      return {
        title: title,
        link: link,
        description: desc,
        date: dt,
        source: sourceLabel,
        thumbnail: thumb
      };
    });
  }

  function fetchFeedItems(feedUrl, sourceLabel) {
    return fetch(rss2jsonUrl(feedUrl))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || data.status !== "ok" || !data.items) return [];
        return normalizeRssItems(data.items, sourceLabel);
      })
      .catch(function () { return []; });
  }

  function buildManualRumbleItem() {
    var dt = CONFIG.rumbleManualDateISO ? safeDate(CONFIG.rumbleManualDateISO) : null;
    var link = (CONFIG.rumbleManualVideoUrl || "").trim() || CONFIG.rumbleProfileUrl;
    var title = (CONFIG.rumbleManualTitle || "").trim() || "Latest on Rumble";

    return {
      title: title,
      link: link,
      description: "Open on Rumble",
      date: dt || new Date(),
      source: "Rumble",
      thumbnail: (CONFIG.rumbleManualThumbnailUrl || "").trim()
    };
  }

  function isSameLocalDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function startOfToday() {
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  function startOfWeekMonday(d) {
    var day = d.getDay(); // 0=Sun..6=Sat
    var diff = (day === 0 ? 6 : day - 1); // Monday=0
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
  }

  function fmtTime(dt) {
    return dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  function fmtDateShort(dt) {
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function escapeHtml(s) {
    return (s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderGuideGrouped(container, items) {
    if (!items || !items.length) {
      msg(container, "No items found yet.");
      return;
    }

    // Sort newest first, cap
    items.sort(function (a, b) { return b.date - a.date; });
    items = items.slice(0, CONFIG.maxItems);

    var now = new Date();
    var todayStart = startOfToday();
    var weekStart = startOfWeekMonday(todayStart);

    var today = [];
    var week = [];
    var older = [];

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it.date) {
        older.push(it);
        continue;
      }

      if (isSameLocalDay(it.date, now)) {
        today.push(it);
      } else if (it.date >= weekStart) {
        week.push(it);
      } else {
        older.push(it);
      }
    }

    function itemRow(it) {
      var badge = escapeHtml(it.source || "Media");
      var title = escapeHtml((it.title || "").trim() || "Untitled");
      var link = it.link || "";
      var desc = escapeHtml((it.description || "").trim()).slice(0, 240);
      var thumb = it.thumbnail || "";

      var timeBlock = "<strong>" + fmtTime(it.date) + "</strong>" + fmtDateShort(it.date);

      var thumbBlock = thumb
        ? "<div class='hbe-guide-thumb'><img src='" + escapeHtml(thumb) + "' alt=''></div>"
        : "<div class='hbe-guide-thumb'></div>";

      var titleBlock = link
        ? "<a href='" + escapeHtml(link) + "' target='_blank' rel='noopener noreferrer'>" + title + "</a>"
        : title;

      return (
        "<div class='hbe-guide-item'>" +
          "<div class='hbe-guide-time'>" + timeBlock + "</div>" +
          thumbBlock +
          "<div class='hbe-guide-main'>" +
            "<div class='hbe-guide-meta'><span class='hbe-badge'>" + badge + "</span></div>" +
            "<div class='hbe-guide-title'>" + titleBlock + "</div>" +
            (desc ? "<p class='hbe-guide-desc'>" + desc + "...</p>" : "") +
          "</div>" +
        "</div>"
      );
    }

    function groupBlock(label, arr) {
      if (!arr.length) return "";
      var rows = "<div class='hbe-guide-list'>";
      for (var j = 0; j < arr.length; j++) rows += itemRow(arr[j]);
      rows += "</div>";

      return (
        "<section class='hbe-guide-group'>" +
          "<div class='hbe-guide-group-title'>" + escapeHtml(label) + "</div>" +
          rows +
        "</section>"
      );
    }

    var html = "";
    html += groupBlock("Today", today);
    html += groupBlock("This week", week);
    html += groupBlock("Older", older);

    write(container, html);
  }

  function boot() {
    waitForElement(CONFIG.guideId, function (gBox) { msg(gBox, "Loading programme guide..."); });

    var youtubeFeed = "https://www.youtube.com/feeds/videos.xml?channel_id=" + CONFIG.youtubeChannelId;

    Promise.all([
      fetchFeedItems(youtubeFeed, "YouTube"),
      fetchFeedItems(CONFIG.rumbleRssUrl, "Rumble")
    ]).then(function (results) {
      var ytItems = results[0] || [];
      var rItems = results[1] || [];

      // Always include one Rumble entry if RSS is empty, so the guide remains stable
      var merged = ytItems.concat(rItems.length ? rItems : [buildManualRumbleItem()]);

      var guideBox = byId(CONFIG.guideId);
      if (guideBox) renderGuideGrouped(guideBox, merged);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
