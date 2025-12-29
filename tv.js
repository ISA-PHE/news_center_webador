(function () {
  var CONFIG = {
    // Programme guide container
    containerId: "hbe-streams-list",

    // OPTIONAL: YouTube player container (create this div on Webador)
    // <div class="hbe-embed-wrap" id="hbe-youtube-latest" style="min-height:480px;"></div>
    youtubePlayerContainerId: "hbe-youtube-latest",

    // YouTube Channel ID (UC...)
    youtubeChannelId: "UCUcLdMy2dnTMBpvKe_29a2g",

    // MVP schedule file you host somewhere (optional)
    // Leave empty if you do not want "upcoming" yet.
    upcomingJsonUrl: "",

    maxItems: 18
  };

  function buildApiUrl(feedUrl) {
    return "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(feedUrl);
  }

  function getContainer() {
    return document.getElementById(CONFIG.containerId);
  }

  function getYouTubePlayerContainer() {
    return document.getElementById(CONFIG.youtubePlayerContainerId);
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
    return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function renderYouTubePlaceholder(message) {
    var el = getYouTubePlayerContainer();
    if (!el) return;

    el.innerHTML =
      "<div style='padding:14px 16px; color:#666; font-size:13px; line-height:1.45;'>" +
      (message || "No public YouTube videos available yet.") +
      "</div>";
  }

  function renderLatestYouTubeVideo(videoId) {
    var el = getYouTubePlayerContainer();
    if (!el) return;

    el.innerHTML =
      '<iframe ' +
      'src="https://www.youtube.com/embed/' + encodeURIComponent(videoId) + '" ' +
      'height="480" width="100%" ' +
      'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ' +
      'allowfullscreen frameborder="0"></iframe>';
  }

  function extractYouTubeVideoIdFromLink(link) {
    // Typical RSS link is like: https://www.youtube.com/watch?v=VIDEOID
    if (!link) return "";
    var m = link.match(/[?&]v=([^&]+)/);
    return (m && m[1]) ? m[1] : "";
  }

  function loadRssAsItems(feedUrl, sourceLabel) {
    return fetch(buildApiUrl(feedUrl))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || data.status !== "ok" || !data.items) return [];
        return data.items.map(function (item) {
          var thumb = item.thumbnail || (item.enclosure && item.enclosure.link) || "";
          return {
            title: item.title || "",
            link: item.link || "",
            description: stripHtml(item.description || ""),
            date: safeDate(item.pubDate) || new Date(),
            source: sourceLabel,
            thumbnail: thumb,
            kind: "published"
          };
        });
      })
      .catch(function () { return []; });
  }

  function loadUpcomingJson(url) {
    if (!url) return Promise.resolve([]);
    return fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.items || !data.items.length) return [];
        return data.items.map(function (x) {
          var dt = safeDate(x.startTime);
          return {
            title: x.title || "Scheduled stream",
            link: x.link || "",
            description: x.description || "",
            date: dt || new Date(),
            source: x.source || "Schedule",
            thumbnail: x.thumbnail || "",
            kind: "upcoming"
          };
        });
      })
      .catch(function () { return []; });
  }

  function renderProgrammeGuide(items) {
    var container = getContainer();
    if (!container) return;

    var upcoming = items.filter(function (x) { return x.kind === "upcoming"; })
      .sort(function (a, b) { return a.date - b.date; });

    var published = items.filter(function (x) { return x.kind !== "upcoming"; })
      .sort(function (a, b) { return b.date - a.date; });

    var merged = upcoming.concat(published).slice(0, CONFIG.maxItems);

    if (!merged.length) {
      container.innerHTML = "<p style='margin:0; color:#666; font-size:13px;'>No items found yet.</p>";
      return;
    }

    var cardsHtml = merged.map(function (item) {
      var dtStr = formatDate(item.date);
      var desc = (item.description || "").slice(0, 220);
      var badge = item.kind === "upcoming" ? "Upcoming" : "Latest";

      var imgHtml = item.thumbnail
        ? '<div class="hbe-card-image-wrap"><img class="hbe-card-img" src="' + item.thumbnail + '" alt=""></div>'
        : "";

      var titleHtml = item.link
        ? '<a href="' + item.link + '" target="_blank" rel="noopener noreferrer">' + item.title + "</a>"
        : item.title;

      return (
        '<article class="hbe-card">' +
        imgHtml +
        '<div class="hbe-card-content">' +
        '<div class="hbe-card-meta">' +
        '<span class="hbe-badge">' + badge + "</span> " +
        dtStr + (item.source ? "  ·  " + item.source : "") +
        "</div>" +
        '<h3 class="hbe-card-title">' + titleHtml + "</h3>" +
        (desc ? '<p class="hbe-card-desc">' + desc + "...</p>" : "") +
        "</div>" +
        "</article>"
      );
    }).join("");

    container.innerHTML =
      '<section class="hbe-guide-block">' +
      '<div class="hbe-grid">' + cardsHtml + "</div>" +
      "</section>";
  }

  function loadYouTubeLatestVideo(youtubeRss) {
    // Only run if the container exists on the page
    if (!getYouTubePlayerContainer()) return;

    if (!CONFIG.youtubeChannelId || CONFIG.youtubeChannelId.indexOf("UC") !== 0) {
      renderYouTubePlaceholder("Configuration missing: please set youtubeChannelId to your UC... channel id.");
      return;
    }

    // Fetch RSS and embed first available video
    fetch(buildApiUrl(youtubeRss))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || data.status !== "ok" || !data.items || !data.items.length) {
          renderYouTubePlaceholder("No public videos found yet.");
          return;
        }

        // Find first item that yields a usable video id
        for (var i = 0; i < data.items.length; i++) {
          var vid = extractYouTubeVideoIdFromLink(data.items[i].link);
          if (vid) {
            renderLatestYouTubeVideo(vid);
            return;
          }
        }

        renderYouTubePlaceholder("Could not detect a playable video from the feed.");
      })
      .catch(function () {
        renderYouTubePlaceholder("YouTube feed could not be loaded right now.");
      });
  }

  function loadAll() {
    var container = getContainer();
    if (!container) {
      setTimeout(loadAll, 200);
      return;
    }

    container.innerHTML = "<p style='margin:0; color:#666; font-size:13px;'>Loading streams and videos...</p>";

    var youtubeRss = "https://www.youtube.com/feeds/videos.xml?channel_id=" + CONFIG.youtubeChannelId;

    // 1) Render the YouTube player (if the div exists in Webador)
    loadYouTubeLatestVideo(youtubeRss);

    // 2) Render the programme guide
    Promise.all([
      loadUpcomingJson(CONFIG.upcomingJsonUrl),
      loadRssAsItems(youtubeRss, "YouTube")
    ]).then(function (results) {
      var all = [];
      results.forEach(function (arr) { all = all.concat(arr || []); });
      renderProgrammeGuide(all);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadAll);
  } else {
    loadAll();
  }
})();
