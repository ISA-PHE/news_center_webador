(function () {
  var CONFIG = {
    guideId: "hbe-streams-list",

    youtubeBoxId: "hbe-youtube-latest",
    youtubeChannelId: "UCUcLdMy2dnTMBpvKe_29a2g",

    rumbleBoxId: "hbe-rumble-latest",
    rumbleProfileUrl: "https://rumble.com/user/project_homebase_earth",
    rumbleRssUrl: "https://openrss.org/feed/rumble.com/user/project_homebase_earth",

    // Manual fallback (keeps Rumble visible even when RSS stays empty)
    rumbleManualVideoUrl: "https://rumble.com/v73n70y-project-homebase-earth-we-are-shaping-a-future-worth-inheriting..html",            // set your real Rumble video URL
    rumbleManualTitle: "Latest on Rumble",
    rumbleManualThumbnailUrl: "https://1a-1791.com/video/fww1/3b/s8/1/s/j/-/L/sj-Lz.oq1b-small-Project-Homebase-Earth-We-a.jpg",        // optional
    rumbleManualDateISO: "2025/12/30 10:50:33	",             // optional

    maxItems: 18
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

  function formatDate(dt) {
    if (!dt) return "";
    return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function rss2jsonUrl(feedUrl) {
    return "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(feedUrl);
  }

  function titleFallback(sourceLabel, title, link) {
    var t = (title || "").trim();
    if (t) return t;

    if (sourceLabel === "Rumble") return "Latest on Rumble";
    if (sourceLabel === "YouTube") return "Latest on YouTube";

    // Fallback to a readable label if absolutely nothing is present
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

  function extractYouTubeVideoId(link) {
    if (!link) return "";
    var m = link.match(/[?&]v=([^&]+)/);
    return (m && m[1]) ? m[1] : "";
  }

  function renderYouTubeLatest(box, items) {
    msg(box, "Loading latest YouTube video...");
    if (!items || !items.length) {
      msg(box, "No public YouTube videos available yet.");
      return;
    }

    var vid = "";
    for (var i = 0; i < items.length; i++) {
      vid = extractYouTubeVideoId(items[i].link);
      if (vid) break;
    }

    if (!vid) {
      msg(box, "Could not extract YouTube video ID.", true);
      return;
    }

    write(
      box,
      '<iframe src="https://www.youtube.com/embed/' +
        encodeURIComponent(vid) +
        '" width="100%" height="480" ' +
        'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ' +
        'allowfullscreen frameborder="0"></iframe>'
    );
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

  function renderRumbleCard(box, item) {
    var title = (item && item.title) ? item.title : "Latest on Rumble";
    var link = (item && item.link) ? item.link : CONFIG.rumbleProfileUrl;
    var thumb = (item && item.thumbnail) ? item.thumbnail : "";
    var dtStr = (item && item.date) ? formatDate(item.date) : "";

    // Always show a title
    var safeTitle = (title || "").trim() || "Latest on Rumble";

    // Consistent layout even if thumb is missing
    var thumbHtml = thumb
      ? '<img src="' + thumb + '" alt="" style="width:120px;height:68px;object-fit:cover;border-radius:10px;border:1px solid rgba(0,0,0,0.06);">'
      : '<div style="width:120px;height:68px;border-radius:10px;border:1px solid rgba(0,0,0,0.06);background:rgba(0,0,0,0.03);"></div>';

    var html =
      '<div style="display:flex;gap:14px;align-items:center;padding:14px 16px;">' +
        thumbHtml +
        '<div style="min-width:0;">' +
          '<div style="font-size:12px;color:#777;margin-bottom:6px;">' + (dtStr ? dtStr + " · " : "") + "Rumble</div>" +
          '<div style="font-size:15px;line-height:1.35;font-weight:600;margin-bottom:6px;">' +
            '<a href="' + link + '" target="_blank" rel="noopener noreferrer">' + safeTitle + "</a>" +
          "</div>" +
          '<div style="font-size:13px;color:#444;line-height:1.45;">Open on Rumble</div>' +
        "</div>" +
      "</div>";

    write(box, html);
  }

  function renderGuide(box, items) {
    if (!items || !items.length) {
      msg(box, "No items found yet.");
      return;
    }

    items.sort(function (a, b) { return b.date - a.date; });

    var out = '<div class="hbe-grid">';
    for (var i = 0; i < Math.min(items.length, CONFIG.maxItems); i++) {
      var it = items[i];

      var dtStr = formatDate(it.date);
      var desc = (it.description || "").slice(0, 220);
      var badge = it.source || "Media";

      // Always reserve thumbnail space so all cards align
      var imgHtml = it.thumbnail
        ? '<div class="hbe-card-image-wrap"><img class="hbe-card-img" src="' + it.thumbnail + '" alt=""></div>'
        : '<div class="hbe-card-image-wrap"><div class="hbe-card-img" style="background:rgba(0,0,0,0.03);border:1px solid rgba(0,0,0,0.06);"></div></div>';

      // Always ensure a title
      var t = (it.title || "").trim() || (badge === "Rumble" ? "Latest on Rumble" : "Latest update");

      var titleHtml = it.link
        ? '<a href="' + it.link + '" target="_blank" rel="noopener noreferrer">' + t + "</a>"
        : t;

      out +=
        '<article class="hbe-card">' +
          imgHtml +
          '<div class="hbe-card-content">' +
            '<div class="hbe-card-meta">' +
              '<span class="hbe-badge">' + badge + "</span> " +
              (dtStr || "") +
            "</div>" +
            '<h3 class="hbe-card-title">' + titleHtml + "</h3>" +
            (desc ? '<p class="hbe-card-desc">' + desc + "...</p>" : "") +
          "</div>" +
        "</article>";
    }
    out += "</div>";

    write(box, out);
  }

  function boot() {
    var youtubeFeed = "https://www.youtube.com/feeds/videos.xml?channel_id=" + CONFIG.youtubeChannelId;

    waitForElement(CONFIG.youtubeBoxId, function (ytBox) { msg(ytBox, "Loading latest YouTube video..."); });
    waitForElement(CONFIG.rumbleBoxId, function (rBox) { msg(rBox, "Loading latest Rumble video..."); });
    waitForElement(CONFIG.guideId, function (gBox) { msg(gBox, "Loading programme guide..."); });

    Promise.all([
      fetchFeedItems(youtubeFeed, "YouTube"),
      fetchFeedItems(CONFIG.rumbleRssUrl, "Rumble")
    ]).then(function (results) {
      var ytItems = results[0] || [];
      var rItems = results[1] || [];

      var ytBox = byId(CONFIG.youtubeBoxId);
      if (ytBox) renderYouTubeLatest(ytBox, ytItems);

      var rBox = byId(CONFIG.rumbleBoxId);
      if (rBox) {
        if (rItems.length) renderRumbleCard(rBox, rItems[0]);
        else renderRumbleCard(rBox, buildManualRumbleItem());
      }

      // Ensure guide always includes one Rumble entry even if feed is empty
      var merged = ytItems.concat(rItems.length ? rItems : [buildManualRumbleItem()]);
      var guideBox = byId(CONFIG.guideId);
      if (guideBox) renderGuide(guideBox, merged);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
