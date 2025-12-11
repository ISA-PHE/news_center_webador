(function() {

  // List of feeds
  var FEEDS = [
    "https://rss.app/feeds/HAFMc17VbGtre4Bj.xml",
    "https://rss.app/feeds/Z6kCJrBrPTs2jc16.xml",
    "https://rss.app/feeds/nmqCeoQWIHXm94y6.xml",
    "https://rss.app/feeds/KFDIWkvk6ZKqJ6Dg.xml",
    "https://rss.app/feeds/C4gX9cbEEAUcyuE1.xml",
    "https://rss.app/feeds/kD2CHcsS01M2Fkhl.xml"
  ];

  // Not used in the client call right now, kept for future use if needed
  var RSS2JSON_API_KEY = "tpi5xtjxdbufkxqeynr2nbxqjhlcxc31uddm4uiw";

  function getContainer() {
    return document.getElementById("hbe-news-list");
  }

  // No count, no order_by, rss2json default is fine
  function buildApiUrl(feedUrl) {
    var base = "https://api.rss2json.com/v1/api.json?rss_url=";
    var qs = encodeURIComponent(feedUrl);
    return base + qs;
  }

  function stripHtml(html) {
    if (!html) return "";
    var tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }

  function loadFeeds() {
    var container = getContainer();
    if (!container) {
      setTimeout(loadFeeds, 200);
      return;
    }

    container.innerHTML = "<p>Loading global news...</p>";

    var allItems = [];
    var errors = [];
    var index = 0;

    function fetchNextFeed() {
      if (index >= FEEDS.length) {
        renderResult(allItems, errors);
        return;
      }

      var feedUrl = FEEDS[index];
      var apiUrl = buildApiUrl(feedUrl);

      fetch(apiUrl)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (!data) {
            errors.push(feedUrl + ": no data");
          } else if (data.status !== "ok") {
            errors.push(feedUrl + ": status " + data.status + " (" + (data.message || "") + ")");
          } else if (!data.items || !data.items.length) {
            errors.push(feedUrl + ": no items");
          } else {
            var feedTitle = (data.feed && data.feed.title) ? data.feed.title : "";
            data.items.forEach(function(item) {
              // Try to get a thumbnail if present
              var thumb = "";
              if (item.thumbnail) {
                thumb = item.thumbnail;
              } else if (item.enclosure && item.enclosure.link) {
                thumb = item.enclosure.link;
              }

              allItems.push({
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                description: item.description,
                feedTitle: feedTitle,
                thumbnail: thumb
              });
            });
          }
          index++;
          fetchNextFeed();
        })
        .catch(function(err) {
          errors.push(feedUrl + ": fetch error " + String(err));
          index++;
          fetchNextFeed();
        });
    }

        function renderResult(items, errorsList) {
      var container = getContainer();
      if (!container) return;

      if (!items.length) {
        var msg = "<p>No news available at the moment.</p>";
        if (errorsList.length) {
          msg += "<p style='font-size:12px;color:#888;'>Debug:<br>" +
            errorsList.join("<br>") +
            "</p>";
        }
        container.innerHTML = msg;
        return;
      }

      // Sort by date, newest first
      items.sort(function(a, b) {
        return new Date(b.pubDate) - new Date(a.pubDate);
      });

      var topItems = items.slice(0, 20);
      var cardsHtml = "";

      topItems.forEach(function(item, index) {
        var pubDate = new Date(item.pubDate);
        var pubDateStr = pubDate.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric"
        });

        var desc = stripHtml(item.description).slice(0, 260);

        // First two items as featured
        var featuredClass = index < 2 ? " hbe-card-featured" : "";

        cardsHtml += '<article class="hbe-card' + featuredClass + '">';

        if (item.thumbnail) {
          cardsHtml +=
            '<div class="hbe-card-image-wrap">' +
              '<img class="hbe-card-img" src="' + item.thumbnail + '" alt="">' +
            "</div>";
        }

        cardsHtml +=
          '<div class="hbe-card-content">' +
            '<h3 class="hbe-card-title">' +
              '<a href="' + item.link + '" target="_blank" rel="noopener noreferrer">' +
                item.title +
              "</a>" +
            "</h3>" +
            '<div class="hbe-card-meta">' +
              pubDateStr +
              (item.feedTitle ? "  ·  " + item.feedTitle : "") +
            "</div>" +
            '<p class="hbe-card-desc">' +
              (desc ? desc + "..." : "") +
            "</p>" +
          "</div>" +
        "</article>";
      });

      if (errorsList.length) {
        cardsHtml +=
          '<p class="hbe-debug">Some feeds reported issues:<br>' +
          errorsList.join("<br>") +
          "</p>";
      }

      container.innerHTML = '<div class="hbe-grid">' + cardsHtml + "</div>";
    }

    fetchNextFeed();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadFeeds);
  } else {
    loadFeeds();
  }

})();
