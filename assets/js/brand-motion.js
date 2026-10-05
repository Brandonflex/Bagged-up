/* ============================================================
   Bagged Up - signature motion and custom pointer
   Shared across the static pages; leaves touch and reduced-motion
   users with the native browser cursor and transitions.
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var forcedColors = window.matchMedia && window.matchMedia('(forced-colors: active)').matches;

  /* The top-bar signature is still between moments, not in a continuous loop.
     It responds to page entry/exit and the compact sticky-header state. */
  function updateScrollState() {
    root.classList.toggle('is-scrolled', window.scrollY > 12);
  }
  updateScrollState();
  window.addEventListener('scroll', updateScrollState, { passive: true });

  function revealFooterMark() {
    var mark = document.querySelector('.footer-brand .wordmark');
    if (!mark || reducedMotion) return;
    if (!('IntersectionObserver' in window)) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        mark.classList.add('brand-mark-reveal');
        observer.unobserve(mark);
        window.setTimeout(function () { mark.classList.remove('brand-mark-reveal'); }, 900);
      });
    }, { threshold: 0.35 });
    observer.observe(mark);
  }
  revealFooterMark();

  /* A short, branded curtain for real page changes. Hash links, downloads,
     external destinations and links already handled by the app stay untouched. */
  function addTransitionCurtain() {
    var curtain = document.createElement('div');
    curtain.className = 'brand-transition';
    curtain.setAttribute('aria-hidden', 'true');

    var lockup = document.createElement('div');
    lockup.className = 'brand-transition__lockup';
    var mark = document.createElement('span');
    mark.className = 'brand-transition__signature';
    var loops = document.createElement('span');
    loops.className = 'brand-transition__loops';
    var name = document.createElement('span');
    name.className = 'brand-transition__name';
    name.textContent = 'Bagged Up';

    lockup.appendChild(mark);
    lockup.appendChild(loops);
    lockup.appendChild(name);
    curtain.appendChild(lockup);
    document.body.appendChild(curtain);
    return curtain;
  }

  var curtain = null;
  var navigating = false;
  function sameDocumentPath(url) {
    var current = new URL(window.location.href);
    var cleanPath = function (pathname) {
      return pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
    };
    return url.origin === current.origin &&
      cleanPath(url.pathname) === cleanPath(current.pathname) &&
      url.search === current.search;
  }

  document.addEventListener('click', function (event) {
    if (reducedMotion || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var target = event.target instanceof Element ? event.target : null;
    var matchedLink = target ? target.closest('a[href]') : null;
    if (!matchedLink) return;
    var link = /** @type {HTMLAnchorElement} */ (matchedLink);
    if (link.hasAttribute('download') || link.hasAttribute('data-no-transition') ||
        (link.target && link.target.toLowerCase() !== '_self')) return;

    var url;
    try { url = new URL(link.href, window.location.href); } catch { return; }
    if (!/^https?:$/.test(url.protocol) || sameDocumentPath(url)) return;
    if (navigating) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    navigating = true;
    if (!curtain) curtain = addTransitionCurtain();
    root.classList.add('page-leaving');
    window.setTimeout(function () { window.location.assign(url.href); }, 230);
  });

  window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;
    root.classList.remove('page-leaving', 'is-scrolled');
    root.classList.add('page-entering');
    updateScrollState();
    window.setTimeout(function () { root.classList.remove('page-entering'); }, 900);
  });

  /* Desktop pointer: crisp centre, softly trailing signature ring, with
     explicit hover, press, text and selection states. */
  if (reducedMotion || !finePointer || forcedColors) return;

  var cursor = document.createElement('div');
  cursor.className = 'atelier-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.dataset.state = 'default';

  var ring = document.createElement('span');
  ring.className = 'atelier-cursor__ring';
  var dot = document.createElement('span');
  dot.className = 'atelier-cursor__dot';
  var signature = document.createElement('span');
  signature.className = 'atelier-cursor__signature';
  cursor.appendChild(ring);
  cursor.appendChild(dot);
  cursor.appendChild(signature);
  document.body.appendChild(cursor);
  root.classList.add('has-custom-cursor');

  var pointX = -100;
  var pointY = -100;
  var ringX = pointX;
  var ringY = pointY;
  var frame = 0;
  var pointerTarget = null;
  var pressed = false;

  function setState(state) {
    cursor.dataset.state = state;
    cursor.classList.toggle('is-native', state === 'native');
    if (state === 'native') cursor.classList.remove('is-visible');
    else cursor.classList.add('is-visible');
  }

  function isTextAtPoint(x, y) {
    try {
      if (typeof document.caretPositionFromPoint === 'function') {
        var caret = document.caretPositionFromPoint(x, y);
        return !!caret && caret.offsetNode.nodeType === 3;
      }
      if (typeof document.caretRangeFromPoint === 'function') {
        var range = document.caretRangeFromPoint(x, y);
        return !!range && range.startContainer.nodeType === 3;
      }
      return false;
    } catch { return false; }
  }

  function stateAt(target, x, y) {
    if (target && target.closest && target.closest(
      'input, textarea, select, [contenteditable="true"], [role="textbox"]'
    )) return 'native';
    if (target && target.closest && target.closest(
      'a[href], button, summary, label, [role="button"], [data-cursor="interactive"]'
    )) return 'hover';
    return isTextAtPoint(x, y) ? 'text' : 'default';
  }

  function selectionActive() {
    var selection = window.getSelection && window.getSelection();
    return !!selection && !selection.isCollapsed && selection.toString().length > 0;
  }

  function moveRing() {
    ringX += (pointX - ringX) * 0.22;
    ringY += (pointY - ringY) * 0.22;
    ring.style.left = ringX + 'px';
    ring.style.top = ringY + 'px';
    if (Math.abs(pointX - ringX) > 0.2 || Math.abs(pointY - ringY) > 0.2) {
      frame = window.requestAnimationFrame(moveRing);
    } else {
      ringX = pointX;
      ringY = pointY;
      ring.style.left = ringX + 'px';
      ring.style.top = ringY + 'px';
      frame = 0;
    }
  }

  document.addEventListener('pointermove', function (event) {
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    pointX = event.clientX;
    pointY = event.clientY;
    pointerTarget = event.target;
    dot.style.left = pointX + 'px';
    dot.style.top = pointY + 'px';
    if (!cursor.classList.contains('is-visible')) {
      ringX = pointX;
      ringY = pointY;
      ring.style.left = ringX + 'px';
      ring.style.top = ringY + 'px';
    }
    if (!frame) frame = window.requestAnimationFrame(moveRing);
    if (pressed) {
      setState('pressed');
    } else if (selectionActive()) {
      setState('selection');
    } else {
      setState(stateAt(pointerTarget, pointX, pointY));
    }
  }, { passive: true });

  document.addEventListener('pointerdown', function (event) {
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    pressed = true;
    pointerTarget = event.target;
    if (!cursor.classList.contains('is-native')) setState('pressed');
  });

  window.addEventListener('pointerup', function () {
    pressed = false;
    if (selectionActive()) setState('selection');
    else setState(stateAt(pointerTarget, pointX, pointY));
  });
  window.addEventListener('pointercancel', function () {
    pressed = false;
    setState('default');
  });
  document.addEventListener('selectionchange', function () {
    if (!cursor.classList.contains('is-visible') || cursor.classList.contains('is-native')) return;
    if (selectionActive()) setState('selection');
    else if (pointerTarget) setState(stateAt(pointerTarget, pointX, pointY));
  });
  window.addEventListener('blur', function () { cursor.classList.remove('is-visible'); });
  window.addEventListener('focus', function () {
    if (pointX >= 0 && pointY >= 0) cursor.classList.add('is-visible');
  });
  document.documentElement.addEventListener('pointerleave', function () {
    cursor.classList.remove('is-visible');
  });
})();
