(function () {
  var CONFIG = {
    guideId: "hbe-streams-list",
    youtubeBoxId: "hbe-youtube-latest",
    youtubeChannelId: "UCUcLdMy2dnTMBpvKe_29a2g",
    maxItems: 18
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function waitForElement(id, cb, tries) {
    tries = tries || 0;
    var el = byId(id);
    if (el) {
      cb(el);
      return;
    }
    if (tries > 50) return; // ~5 seconds max
    setTimeout(function () {
      waitForElement(id, cb, tries + 1);
    }, 100);
  }

  function write(el, html) {
    el.innerHTML = html;
  }

  function msg(el, text, error) {
    write(
      el,
      "<div style='padding:14px 16px;font-size:13px;color:" +
        (error ? "#8a1f1f" : "#666") +
        ";'>" +
        text +
        "</div>"
    );
  }

  function loadYouTube(box) {
    msg(box, "Loading latest YouTube video…");

    var rss =
      "https://api.rss2json.com/v1/api.json?rss_url=" +
      encodeURIComponent(
        "https://www.youtube.com/feeds/videos.xml?channel_id=" +
          CONFIG.youtubeChannelId
      );

    fetch(rss)
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (!data || !data.items || !data.items.length) {
          msg(box, "No public YouTube videos available yet.");
          return;
        }

        var link = data.items[0].link || "";
        var m = link.match(/[?&]v=([^&]+)/);
        if (!m) {
          msg(box, "Could not extract YouTube video ID.", true);
          return;
        }

        write(
          box,
          '<iframe src="https://www.youtube.com/embed/' +
            m[1] +
            '" width="100%" height="480" ' +
            'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
            'allowfullscreen frameborder="0"></iframe>'
        );
      })
      .catch(function () {
        msg(box, "YouTube feed blocked or rate-limited.", true);
      });
  }

  function boot() {
    waitForElement(CONFIG.youtubeBoxId, loadYouTube);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
