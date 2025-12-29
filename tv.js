(function () {
  var CONFIG = {
    containerId: "hbe-streams-list",
    youtubePlayerContainerId: "hbe-youtube-latest",

    // UC id only
    youtubeChannelId: "UCUcLdMy2dnTMBpvKe_29a2g",

    upcomingJsonUrl: "",
    maxItems: 18
  };

  function buildApiUrl(feedUrl) {
    return "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(feedUrl);
  }

  function el(id) {
    return document.getElementById(id);
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

  function setBoxMessage(targetEl, message, isError) {
    if (!targetEl) return;
    targetEl.innerHTML =
      "<div style='padding:14px 16px; font-size:13px; line-height:1.45; color:" +
      (isError ? "#8a1f1f" : "#666") +
      ";'>" +
      message +
      "</div>";
  }

  function renderLatestYouTubeVideo(videoId) {
    var box = el(CONFIG.youtubePlayerContainerId);
    if (!box) return;

    box.innerHTML =
      '<iframe ' +
      'src="https://www.youtube.com/embed/' + encodeURIComponent(videoId) + '" ' +
      'height="480" width="100%" ' +
      'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ' +
      'allowfullscreen frameborder="0"></iframe>';
  }

  function extractYouTubeVideoId(link) {
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
    var container = el(CONFIG.containerId);
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

    container.innerHTML = '<div class="hbe-grid">' + cardsHtml + "</div>";
  }

  function loadYouTubeLatestVideo(youtubeRss) {
    var box = el(CONFIG.youtubePlayerContainerId);
    if (!box) return;

    // Show something immediately so you never see a blank white box
    setBoxMessage(box, "Loading latest YouTube video...");

    if (!CONFIG.youtubeChannelId || CONFIG.youtubeChannelId.indexOf("UC") !== 0) {
      setBoxMessage(box, "YouTube configuration error: youtubeChannelId must be the UC... id (not a URL).", true);
      return;
    }

    fetch(buildApiUrl(youtubeRss))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || data.status !== "ok") {
          setBoxMessage(box, "YouTube feed error (rss2json). Try again later.", true);
          return;
        }
        if (!data.items || !data.items.length) {
          setBoxMessage(box, "No public YouTube videos found yet.");
          return;
        }

        for (var i = 0; i < data.items.length; i++) {
          var vid = extractYouTubeVideoId(data.items[i].link);
          if (vid) {
            renderLatestYouTubeVideo(vid);
            return;
          }
        }

        setBoxMessage(box, "Could not detect a playable YouTube video from the feed.", true);
      })
      .catch(function (e) {
        setBoxMessage(box, "YouTube feed could not be loaded. This is usually a network block or rate limit.", true);
      });
  }

  function loadAll() {
    var guide = el(CONFIG.containerId);
    if (!guide) {
      setTimeout(loadAll, 200);
      return;
    }

    guide.innerHTML = "<p style='margin:0; color:#666; font-size:13px;'>Loading programme guide...</p>";

    var youtubeRss = "https://www.youtube.com/feeds/videos.xml?channel_id=" + CONFIG.youtubeChannelId;

    // Player (if the div exists)
    loadYouTubeLatestVideo(youtubeRss);

    // Guide
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
