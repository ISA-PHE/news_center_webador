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

  var RSS2JSON_API_KEY = "tpi5xtjxdbufkxqeynr2nbxqjhlcxc31uddm4uiw";

  function getContainer() {
    return document.getElementById("hbe-news-list");
  }

    function buildApiUrl(feedUrl) {
    var base = "https://api.rss2json.com/v1/api.json?";
    var qs =
      "api_key=" + encodeURIComponent(RSS2JSON_API_KEY) +
      "&rss_url=" + encodeURIComponent(feedUrl) +
      "&count=5&order_by=pubDate&order_dir=desc";
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
      // Container not yet in DOM - try again shortly
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
              allItems.push({
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                description: item.description,
                feedTitle: feedTitle
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
      var html = "";

      topItems.forEach(function(item) {
        var pubDate = new Date(item.pubDate);
        var pubDateStr = pubDate.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric"
        });

        var desc = stripHtml(item.description).slice(0, 240);

        html += '<article style="' +
          'border: 1px solid rgba(0,0,0,0.08);' +
          'border-radius: 8px;' +
          'padding: 16px 18px;' +
          'margin-bottom: 14px;' +
          'box-shadow: 0 2px 5px rgba(0,0,0,0.06);' +
          'background: #fff;' +
          '">' +
          '<h3 style="margin: 0 0 6px; font-size: 17px;">' +
          '<a href="' + item.link + '" target="_blank" rel="noopener noreferrer" ' +
          'style="text-decoration: none; color: #111;">' +
          item.title +
          "</a>" +
          "</h3>" +
          '<div style="font-size: 13px; color: #777; margin-bottom: 8px;">' +
          "<span>" + pubDateStr + "</span>" +
          (item.feedTitle ? '<span style="margin-left: 10px;"> - ' + item.feedTitle + "</span>" : "") +
          "</div>" +
          '<p style="margin: 0; font-size: 14px; line-height: 1.5; color: #444;">' +
          (desc ? desc + "..." : "") +
          "</p>" +
          "</article>";
      });

      if (errorsList.length) {
        html += "<p style='font-size:12px;color:#888;margin-top:10px;'>Some feeds reported issues:<br>" +
          errorsList.join("<br>") +
          "</p>";
      }

      container.innerHTML = html;
    }

    fetchNextFeed();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadFeeds);
  } else {
    loadFeeds();
  }

})();
