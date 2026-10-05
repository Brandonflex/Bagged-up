/* Apply the saved theme before the stylesheet is painted. Kept external so
   the site can use a strict script-src 'self' Content Security Policy. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  try {
    var theme = window.localStorage.getItem('bagged-up-theme');
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch {
    /* Storage may be unavailable in private or sandboxed browsing contexts. */
  }
})();
