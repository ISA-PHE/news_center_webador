(function () {
  var CONFIG = {
    containerId: "hbe-streams-list",

    // Twitch
    twitchChannel: "project_homebase_earth",
    twitchParentDomains: "projecthomebase.earth",

    // YouTube: paste your Channel ID here (starts with UC...)
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

  function render(items) {
    var container = getContainer();
    if (!container) return;

    var upcoming = items.filter(function (x) { return x.kind === "upcoming"; })
      .sort(function (a, b) { return a.date - b.date; });

    var published = items.filter(function (x) { return x.kind !== "upcoming"; })
      .sort(function (a, b) { return b.date - a.date; });

    var merged = upcoming.concat(published).slice(0, CONFIG.maxItems);

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
              '<span class="hbe-badge">' + badge + '</span> ' +
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
        '<h2 class="hbe-section-title">Programme Guide</h2>' +
        '<div class="hbe-grid">' + cardsHtml + "</div>" +
      "</section>";
  }

  function loadAll() {
    var container = getContainer();
    if (!container) {
      setTimeout(loadAll, 200);
      return;
    }

    container.innerHTML = "<p>Loading streams and videos...</p>";

    // YouTube RSS needs channel_id (UC...)
    var youtubeRss = "https://www.youtube.com/feeds/videos.xml?channel_id=" + CONFIG.youtubeChannelId;

    Promise.all([
      loadUpcomingJson(CONFIG.upcomingJsonUrl),
      loadRssAsItems(youtubeRss, "YouTube")
    ]).then(function (results) {
      var all = [];
      results.forEach(function (arr) { all = all.concat(arr || []); });
      render(all);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadAll);
  } else {
    loadAll();
  }
})();
