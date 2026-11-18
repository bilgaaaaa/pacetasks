// Language of the site: English at the root, Italian under it/. A first visit
// opens in the browser's language; after that, the choice made with the language
// link is kept. Loaded in the head, before the page shows, so there is no flash.
(function () {
  var STORAGE_KEY = "pacetasks.site.language";
  var pageLanguage = document.documentElement.lang === "it" ? "it" : "en";

  var read = function () {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null; // storage is blocked: fall back to the browser's language
    }
  };
  var remember = function (language) {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch (e) {
      console.info("[site] language choice not saved", e);
    }
  };

  var browserLanguage = (navigator.language || "").toLowerCase().indexOf("it") === 0 ? "it" : "en";
  var wanted = read() || browserLanguage;
  if (wanted !== pageLanguage) {
    var page = location.pathname.split("/").pop();
    location.replace((wanted === "it" ? "it/" : "../") + page + location.search + location.hash);
    return;
  }

  // The language link keeps the choice, so the other pages open in it too.
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("a.lang-switch").forEach(function (link) {
      link.addEventListener("click", function () {
        remember(link.hreflang);
      });
    });
  });
})();
