// Pocket GM house look: tells the stylesheet which game this is and lifts the club's colour
// out of the game's own header so the top bar and the backdrop can wear it. Display only.
(function () {
  var root = document.documentElement;
  root.setAttribute("data-game", "__GAME__");
  function usable(c) {
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c || "");
    if (!m || (m[4] !== undefined && +m[4] < .5)) return null;
    var r = +m[1], g = +m[2], b = +m[3], lum = (r * 299 + g * 587 + b * 114) / 1000;
    if (lum < 26) return null;                       // near-black clubs: keep the accent
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  function find() {
    var el = document.querySelector("#root > div > .sticky.top-0 button span.rounded-sm")       // hockey: colour bar by the club name
      || document.querySelector("header svg [fill]:not([fill='none'])")                         // baseball: club crest
      || document.querySelector("header > .absolute")                                           // baseball: colour strip
      || document.querySelector("main .rounded-full[style*='background']");                     // soccer: club badge on the hub
    if (!el) return null;
    var cs = getComputedStyle(el);
    return usable(el.getAttribute && el.getAttribute("fill") && cs.fill) || usable(cs.backgroundColor) || usable(cs.fill);
  }
  var last = "";
  function tick() {
    var c = find();
    if (c && c !== last) { last = c; root.style.setProperty("--team", c); }
    else if (!c && !document.querySelector("header, #root > div > .sticky.top-0") && last) { last = ""; root.style.removeProperty("--team"); }
  }
  setInterval(tick, 1200); setTimeout(tick, 400);
})();
