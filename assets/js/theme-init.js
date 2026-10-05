/* Apply the saved theme before the stylesheet is painted. Kept external so
   the site can use a strict script-src 'self' Content Security Policy. */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');
  if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('page-entering');
    window.setTimeout(function () { root.classList.remove('page-entering'); }, 900);
  }

  try {
    var theme = window.localStorage.getItem('bagged-up-theme');
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch {
    /* Storage may be unavailable in private or sandboxed browsing contexts. */
  }
})();
