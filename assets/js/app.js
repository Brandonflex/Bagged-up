/* ============================================================
   Bagged Up - storefront behaviour
   Cart (localStorage) · Nav overlay · Toasts · Shop filters
   PDP gallery · Review form UX · WhatsApp checkout
   ============================================================ */
(function () {
  'use strict';

  var DEPTH = (Number(document.documentElement.dataset.depth) || 0);
  var ROOT = DEPTH === 0 ? '' : new Array(DEPTH + 1).join('../');
  var PRODUCTS = window.BAGGED_UP_PRODUCTS || [];
  var REVIEWS = window.BAGGED_UP_REVIEWS || [];
  var WA_NUMBER = '254113599345';
  var CART_KEY = 'bagged-up-cart-v1';
  var DELIVERY_KEY = 'bagged-up-delivery-v1';
  var SAVED_KEY = 'bagged-up-saved-v1';
  var RECENT_KEY = 'bagged-up-recent-v1';

  /* Storage can throw in sandboxed/opaque-origin frames - never let it break
     the storefront; degrade gracefully to in-memory */
  var mem = {};
  function storeGet(k) {
    try { return window.localStorage.getItem(k); } catch { return (k in mem) ? mem[k] : null; }
  }
  function storeSet(k, v) {
    try { window.localStorage.setItem(k, v); } catch { mem[k] = v; }
  }

  var DELIVERY_OPTIONS = [
    { id: 'nairobi', label: 'Nairobi & environs', note: 'Same-day or next-day rider', fee: 250 },
    { id: 'countrywide', label: 'Countrywide', note: '1–3 days · courier to your town', fee: 400 }
  ];
  var FREE_DELIVERY_OVER = 5000;

  /* ---------- helpers ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function money(n) {
    return 'KSh ' + Number(n).toLocaleString('en-KE');
  }
  function waLink(text) {
    return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text);
  }
  function slugFromHref(href) {
    var m = String(href || '').match(/([a-z0-9-]+)\.html(?:[?#]|$)/);
    return m ? m[1] : '';
  }
  function readList(key) {
    try {
      var v = JSON.parse(storeGet(key) || '[]');
      return Object.prototype.toString.call(v) === '[object Array]' ? v : [];
    } catch { return []; }
  }
  function writeList(key, list) { storeSet(key, JSON.stringify(list)); }
  function isSaved(slug) { return readList(SAVED_KEY).indexOf(slug) !== -1; }
  function toggleSaved(slug) {
    var list = readList(SAVED_KEY);
    var i = list.indexOf(slug);
    if (i === -1) list.unshift(slug); else list.splice(i, 1);
    writeList(SAVED_KEY, list);
    return i === -1;
  }
  /* ---------- delivery dates (Amazon and Jumia pattern) ---------- */
  function shortDate(d) {
    var wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return wd[d.getDay()] + ' ' + d.getDate() + ' ' + mo[d.getMonth()];
  }
  function businessDaysFrom(from, n) {
    var d = new Date(from.getTime());
    var added = 0;
    while (added < n) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) added++;
    }
    return d;
  }
  /* Nairobi is same day when the order lands before the 3pm rider cut-off,
     otherwise the next business day. Countrywide is a two to four day window. */
  function deliveryEta() {
    var now = new Date();
    var beforeCutoff = now.getHours() < 15;
    return {
      cutoff: beforeCutoff,
      nairobi: beforeCutoff ? 'today' : shortDate(businessDaysFrom(now, 1)),
      country: shortDate(businessDaysFrom(now, 2)) + ' to ' + shortDate(businessDaysFrom(now, 4))
    };
  }
  function deliveryEtaLine() {
    var e = deliveryEta();
    return (e.cutoff ? 'Order before 3pm: Nairobi delivery today. ' : 'Order now: Nairobi delivery ' + e.nairobi + '. ') +
      'Countrywide ' + e.country + '.';
  }

  function escHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function productBySlug(slug) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].slug === slug) return PRODUCTS[i];
    return null;
  }

  /* ---------- cart store ---------- */
  function readCart() {
    try {
      var raw = JSON.parse(storeGet(CART_KEY) || '{}');
      var out = {};
      Object.keys(raw).forEach(function (k) {
        var q = parseInt(raw[k], 10);
        if (q > 0 && productBySlug(k)) out[k] = Math.min(q, 99);
      });
      return out;
    } catch { return {}; }
  }
  function writeCart(cart) {
    storeSet(CART_KEY, JSON.stringify(cart));
    updateBadge();
    document.dispatchEvent(new CustomEvent('cart:change'));
  }
  function cartCount(cart) {
    cart = cart || readCart();
    return Object.keys(cart).reduce(function (n, k) { return n + cart[k]; }, 0);
  }
  function cartSubtotal(cart) {
    cart = cart || readCart();
    return Object.keys(cart).reduce(function (n, k) {
      var p = productBySlug(k);
      return p ? n + p.price * cart[k] : n;
    }, 0);
  }
  function addToCart(slug, qty) {
    var cart = readCart();
    cart[slug] = (cart[slug] || 0) + (qty || 1);
    writeCart(cart);
    var p = productBySlug(slug);
    if (p) toast('Added to bag: ' + p.name);
    var badge = $('.cart-count');
    if (badge) {
      badge.classList.remove('pulse');
      void badge.offsetWidth;
      badge.classList.add('pulse');
    }
  }

  /* ---------- badge ---------- */
  function updateBadge() {
    var badge = $('.cart-count');
    if (!badge) return;
    var n = cartCount();
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.classList.toggle('show', n > 0);
  }

  /* ---------- toast ---------- */
  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '<span class="msg"></span><a href="' + ROOT + 'cart.html">View bag</a>';
      document.body.appendChild(toastEl);
    }
    toastEl.querySelector('.msg').textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 3200);
  }

  /* ---------- nav overlay ---------- */
  var menuBtn = $('.menu-btn');
  var navPanel = $('#nav-panel');
  var navBackdrop = $('#nav-backdrop');
  function setNav(open) {
    if (!navPanel) return;
    document.body.classList.toggle('nav-open', open);
    navPanel.classList.toggle('open', open);
    if (navBackdrop) navBackdrop.classList.toggle('show', open);
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
    if (open) {
      var iconOpen = menuBtn && menuBtn.querySelector('.i-open');
      var iconClose = menuBtn && menuBtn.querySelector('.i-close');
      if (iconOpen) iconOpen.classList.add('hidden');
      if (iconClose) iconClose.classList.remove('hidden');
    } else {
      var iconOpen2 = menuBtn && menuBtn.querySelector('.i-open');
      var iconClose2 = menuBtn && menuBtn.querySelector('.i-close');
      if (iconOpen2) iconOpen2.classList.remove('hidden');
      if (iconClose2) iconClose2.classList.add('hidden');
    }
  }
  if (menuBtn && navPanel) {
    menuBtn.addEventListener('click', function () {
      setNav(!navPanel.classList.contains('open'));
    });
    navBackdrop && navBackdrop.addEventListener('click', function () { setNav(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setNav(false);
    });
    $all('a', navPanel).forEach(function (a) {
      a.addEventListener('click', function () { setNav(false); });
    });
  }

  /* ---------- add-to-cart bindings ---------- */
  document.addEventListener('click', function (e) {
    var btn = /** @type {Element} */ (e.target).closest('[data-add]');
    if (!btn) return;
    e.preventDefault();
    addToCart(btn.getAttribute('data-add'), 1);
  });

  /* ---------- shop: filter + sort ---------- */
  var shopGrid = $('#shop-grid');
  if (shopGrid) {
    var chips = $all('.chip[data-cat]');
    var sortSel = $('#sort-select');
    var note = $('#result-note');

    /* The saved filter is built here rather than in the markup, so every shop
       page keeps one source of truth for the chips. */
    if (chips.length) {
      var savedChip = document.createElement('button');
      savedChip.type = 'button';
      savedChip.className = 'chip chip-saved';
      savedChip.setAttribute('data-cat', '__saved');
      savedChip.innerHTML = 'Saved <span class="chip-count"></span>';
      chips[0].parentNode.appendChild(savedChip);
      chips = $all('.chip[data-cat]');
      var countEl = savedChip.querySelector('.chip-count');
      var paintCount = function () {
        var n = readList(SAVED_KEY).length;
        countEl.textContent = n ? String(n) : '';
      };
      paintCount();
      document.addEventListener('bagged:saved', paintCount);
    }

    function applyShop() {
      var cat = (chips.filter(function (c) { return c.classList.contains('active'); })[0] || {}).getAttribute('data-cat') || 'all';
      var cards = $all('.card', shopGrid);
      var saved = readList(SAVED_KEY);
      var visible = 0;
      cards.forEach(function (card) {
        var show;
        if (cat === '__saved') {
          var link = card.querySelector('a[href]');
          show = saved.indexOf(slugFromHref(link && link.getAttribute('href'))) !== -1;
        } else {
          show = cat === 'all' || card.getAttribute('data-cat') === cat;
        }
        card.classList.toggle('hidden', !show);
        if (show) visible++;
      });
      if (sortSel) {
        var mode = sortSel.value;
        var sorted = cards.slice().sort(function (a, b) {
          var pa = Number(a.getAttribute('data-price'));
          var pb = Number(b.getAttribute('data-price'));
          var na = (a.getAttribute('data-name') || '').toLowerCase();
          var nb = (b.getAttribute('data-name') || '').toLowerCase();
          if (mode === 'price-asc') return pa - pb;
          if (mode === 'price-desc') return pb - pa;
          if (mode === 'name') return na < nb ? -1 : na > nb ? 1 : 0;
          return 0; // newest = build order (already newest first)
        });
        sorted.forEach(function (c) { shopGrid.appendChild(c); });
      }
      if (note) {
        note.textContent = cat === '__saved'
          ? (visible ? visible + ' saved piece' + (visible === 1 ? '' : 's') : 'Nothing saved yet')
          : visible + ' piece' + (visible === 1 ? '' : 's') + (cat === 'all' ? '' : ' in this edit');
      }
    }
    document.addEventListener('bagged:saved', function () { applyShop(); });
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        applyShop();
      });
    });
    sortSel && sortSel.addEventListener('change', applyShop);
    applyShop();
  }

  /* ---------- PDP gallery ---------- */
  var pdpMain = $('#pdp-main-img');
  if (pdpMain) {
    pdpMain.addEventListener('load', function () { pdpMain.style.opacity = '1'; });
    $all('.thumbs button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var src = btn.getAttribute('data-src');
        if (pdpMain.getAttribute('src') === src) return;
        pdpMain.style.opacity = '0';
        setTimeout(function () { pdpMain.src = src; }, 180);
        pdpMain.alt = btn.getAttribute('data-alt') || pdpMain.alt;
        $all('.thumbs button').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });
  }

  /* ---------- review form UX (static site: shows confirmation) ---------- */
  var reviewForm = $('#review-form');
  if (reviewForm) {
    var stars = $all('.star-input button');
    var ratingInput = $('#rating-value');
    stars.forEach(function (btn, idx) {
      btn.addEventListener('click', function () {
        ratingInput.value = String(idx + 1);
        stars.forEach(function (b, i) { b.classList.toggle('on', i <= idx); });
      });
    });
    reviewForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#review-name').value.trim();
      if (!name || !Number(ratingInput.value)) {
        toast('Add your name and a rating first.');
        return;
      }
      reviewForm.reset();
      stars.forEach(function (b) { b.classList.remove('on'); });
      ratingInput.value = '';
      toast('Thank you! Your review will appear once approved.');
    });
  }

  /* ---------- cart page ---------- */
  var cartLines = $('#cart-lines');
  if (cartLines) {
    var summaryBox = $('#cart-summary');
    var emptyBox = $('#cart-empty');

    function chosenDelivery() {
      var saved = storeGet(DELIVERY_KEY);
      var opt = DELIVERY_OPTIONS.filter(function (o) { return o.id === saved; })[0];
      return opt || DELIVERY_OPTIONS[0];
    }

    function deliveryFee(subtotal, opt) {
      if (subtotal >= FREE_DELIVERY_OVER) return 0;
      return opt.fee;
    }

    function freeDeliveryBar(subtotal) {
      if (subtotal >= FREE_DELIVERY_OVER) {
        return '<div class="free-bar done" role="status">' +
          '<div class="fb-txt"><b>Free delivery unlocked.</b> This order ships on us.</div>' +
          '<div class="fb-track"><span style="width:100%"></span></div>' +
        '</div>';
      }
      var left = FREE_DELIVERY_OVER - subtotal;
      var pct = Math.max(4, Math.round((subtotal / FREE_DELIVERY_OVER) * 100));
      return '<div class="free-bar" role="status">' +
        '<div class="fb-txt">' + money(left) + ' more and delivery is free.</div>' +
        '<div class="fb-track"><span style="width:' + pct + '%"></span></div>' +
      '</div>';
    }

    function renderCart() {
      var cart = readCart();
      var slugs = Object.keys(cart);
      var hasItems = slugs.length > 0;
      emptyBox.classList.toggle('hidden', hasItems);
      summaryBox.classList.toggle('hidden', !hasItems);
      cartLines.classList.toggle('hidden', !hasItems);
      if (!hasItems) return;

      cartLines.innerHTML = slugs.map(function (slug) {
        var p = productBySlug(slug);
        var q = cart[slug];
        return (
          '<div class="cart-line" data-slug="' + slug + '">' +
            '<a class="ph" href="' + ROOT + 'shop/' + slug + '.html"><img src="' + ROOT + p.images[0] + '" alt="' + esc(p.name) + '"></a>' +
            '<div>' +
              '<div class="name"><a href="' + ROOT + 'shop/' + slug + '.html">' + esc(p.name) + '</a></div>' +
              '<div class="unit">' + money(p.price) + ' each</div>' +
              '<div class="controls">' +
                '<div class="qty" aria-label="Quantity">' +
                  '<button type="button" data-dec aria-label="Decrease quantity">−</button>' +
                  '<span class="q">' + q + '</span>' +
                  '<button type="button" data-inc aria-label="Increase quantity">+</button>' +
                '</div>' +
                '<button type="button" class="remove-link" data-remove>Remove</button>' +
              '</div>' +
            '</div>' +
            '<div class="line-total">' + money(p.price * q) + '</div>' +
          '</div>'
        );
      }).join('');

      renderSummary();
    }

    function renderSummary() {
      var cart = readCart();
      var subtotal = cartSubtotal(cart);
      var opt = chosenDelivery();
      var fee = deliveryFee(subtotal, opt);
      var total = subtotal + fee;

      var optsHtml = DELIVERY_OPTIONS.map(function (o) {
        var isSel = o.id === opt.id;
        var oFee = subtotal >= FREE_DELIVERY_OVER ? 0 : o.fee;
        return (
          '<label class="delivery-opt' + (isSel ? ' selected' : '') + '">' +
            '<input type="radio" name="delivery" value="' + o.id + '"' + (isSel ? ' checked' : '') + '>' +
            '<span><b>' + o.label + '</b><span>' + o.note + '</span></span>' +
            '<span class="fee">' + (oFee === 0 ? '<span class="free-tag">Free</span>' : money(oFee)) + '</span>' +
          '</label>'
        );
      }).join('');

      summaryBox.innerHTML =
        '<h2>Order Summary</h2>' +
        '<div class="row"><span class="muted">Subtotal</span><span>' + money(subtotal) + '</span></div>' +
        '<div class="delivery-pick" role="radiogroup" aria-label="Delivery option">' + optsHtml + '</div>' +
        '<p class="eta">' + esc(deliveryEtaLine()) + '</p>' +
        '<div class="row"><span class="muted">Delivery' + (fee === 0 ? ' (on us)' : '') + '</span>' +
          '<span>' + (fee === 0
            ? '<span class="free-tag">Free</span>&nbsp;<span class="strike">' + money(opt.fee) + '</span>'
            : money(fee)) + '</span></div>' +
        freeDeliveryBar(subtotal) +
        '<div class="row total"><span>Total</span><span class="amt">' + money(total) + '</span></div>' +
        '<p style="margin-top:1.2rem"><a class="btn btn-green btn-block" id="wa-checkout" href="#">' +
          'Checkout via WhatsApp' +
        '</a></p>' +
        '<details class="wa-preview">' +
          '<summary>Preview order message</summary>' +
          '<pre id="wa-msg-preview"></pre>' +
          '<button class="btn btn-sm" type="button" data-copy-order>Copy order details</button>' +
        '</details>' +
        '<p class="checkout-note">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '<span>No online payment needed. Pay via M-Pesa or cash on delivery. We\u2019ll confirm your order on WhatsApp.</span>' +
        '</p>';

      var waBtn = $('#wa-checkout');
      waBtn.href = buildWaMessage(cart, opt, fee, total);
      waBtn.setAttribute('target', '_blank');
      waBtn.setAttribute('rel', 'noopener');

      var msg = buildWaMessage(cart, opt, fee, total);
      var preview = $('#wa-msg-preview');
      if (preview) preview.textContent = window.decodeURIComponent
        ? decodeURIComponent(msg.split('text=')[1] || '')
        : '';
      $all('input[name="delivery"]', summaryBox).forEach(function (radio) {
        radio.addEventListener('change', function () {
          storeSet(DELIVERY_KEY, radio.value);
          renderSummary();
        });
      });
    }

    function buildWaMessage(cart, opt, fee, total) {
      var lines = Object.keys(cart).map(function (slug, i) {
        var p = productBySlug(slug);
        return (i + 1) + '. ' + p.name + ' × ' + cart[slug] + ': ' + money(p.price * cart[slug]);
      });
      var msg =
        'Hello Bagged Up! I would like to place an order:\n\n' +
        lines.join('\n') + '\n\n' +
        'Subtotal: ' + money(cartSubtotal(cart)) + '\n' +
        'Delivery (' + opt.label + '): ' + (fee === 0 ? 'Free' : money(fee)) + '\n' +
        'Total: ' + money(total) + '\n\n' +
        'Payment: M-Pesa or cash on delivery\n\n' +
        'My name:\nDelivery location:\nPreferred delivery time:';
      return waLink(msg);
    }

    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    cartLines.addEventListener('click', function (e) {
      var line = /** @type {Element} */ (e.target).closest('.cart-line');
      if (!line) return;
      var slug = line.getAttribute('data-slug');
      if (e.target.closest('[data-inc]')) {
        var cart = readCart();
        cart[slug] = Math.min((cart[slug] || 1) + 1, 99);
        writeCart(cart);
      } else if (e.target.closest('[data-dec]')) {
        var cart2 = readCart();
        cart2[slug] = (cart2[slug] || 1) - 1;
        if (cart2[slug] <= 0) delete cart2[slug];
        writeCart(cart2);
      } else if (e.target.closest('[data-remove]')) {
        var cart3 = readCart();
        delete cart3[slug];
        writeCart(cart3);
      }
    });

    document.addEventListener('cart:change', renderCart);
    renderCart();
  }

  /* ---------- copy order details (clipboard with fallback) ---------- */
  document.addEventListener('click', function (e) {
    var btn = /** @type {Element} */ (e.target).closest('[data-copy-order]');
    if (!btn) return;
    var pre = $('#wa-msg-preview');
    var text = pre ? pre.textContent : '';
    if (!text) { toast('Nothing to copy yet. Add something to your bag first.'); return; }
    function done() { toast('Order copied. Paste it into WhatsApp.'); }
    function fail() { toast('Could not copy automatically. Long-press the message to copy.'); }
    function legacy() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch { return false; }
    }
    /* sync path first - the async clipboard API can stay pending forever
       in embedded/sandboxed frames, so never depend on it for feedback */
    if (legacy()) { done(); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      var settled = false;
      var guard = setTimeout(function () {
        if (!settled) { settled = true; fail(); }
      }, 800);
      navigator.clipboard.writeText(text).then(function () {
        if (!settled) { settled = true; clearTimeout(guard); done(); }
      }, function () {
        if (!settled) { settled = true; clearTimeout(guard); fail(); }
      });
    } else {
      fail();
    }
  });

  /* ---------- scroll reveals ---------- */
  var rvs = $all('.rv');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function revealAll() { rvs.forEach(function (el) { el.classList.add('in'); }); }
  if (!('IntersectionObserver' in window) || reduced) {
    revealAll();
  } else {
    try {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('in');
            io.unobserve(en.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });
      rvs.forEach(function (el) { io.observe(el); });
      /* IO probe: in some sandboxed/opaque-origin frames IntersectionObserver
         reports EVERYTHING as non-intersecting, forever. Observe a sentinel
         that is always on screen - if even that never "intersects", IO is
         broken here: reveal everything. An invisible page is never acceptable. */
      var sentinel = document.createElement('div');
      sentinel.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;pointer-events:none;opacity:0';
      document.body.appendChild(sentinel);
      var probeOk = false;
      var probe = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) { probeOk = true; break; }
        }
      });
      probe.observe(sentinel);
      setTimeout(function () {
        probe.disconnect();
        if (sentinel.parentNode) sentinel.parentNode.removeChild(sentinel);
        if (!probeOk) revealAll();
      }, 700);
      /* second net: if IO never reveals anything (broken in some frames),
         a passive scroll listener reveals pieces as they enter the viewport */
      setTimeout(function () {
        if (document.querySelector('.rv.in')) return; // IO is doing its job
        var onScroll = function () {
          var vh = window.innerHeight || document.documentElement.clientHeight;
          rvs.forEach(function (el) {
            if (el.classList.contains('in')) return;
            var r = el.getBoundingClientRect();
            if (r.top < vh * 0.92 && r.bottom > 0) el.classList.add('in');
          });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
      }, 900);
    } catch { revealAll(); }
  }

  /* ---------- card second image on first hover ---------- */
  var canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (canHover) {
    document.addEventListener('pointerover', function (e) {
      var media = /** @type {Element} */ (e.target).closest('.card-media[data-alt-src]');
      if (!media || media.getAttribute('data-loaded')) return;
      media.setAttribute('data-loaded', '1');
      var img = document.createElement('img');
      img.className = 'b';
      img.src = media.getAttribute('data-alt-src');
      img.alt = '';
      img.loading = 'lazy';
      media.appendChild(img);
    });
  }

  /* ---------- PDP 3D tilt (fine pointers only; ambient breathe on touch via CSS) ---------- */
  var tiltStage = /** @type {HTMLElement|null} */ (document.querySelector('.pdp-gallery .tilt'));
  if (tiltStage && canHover && !reduced) {
    var tImg = /** @type {HTMLImageElement} */ (tiltStage.querySelector('img'));
    tiltStage.addEventListener('pointermove', function (e) {
      var pe = /** @type {PointerEvent} */ (e);
      var r = tiltStage.getBoundingClientRect();
      var x = (pe.clientX - r.left) / r.width - 0.5;
      var y = (pe.clientY - r.top) / r.height - 0.5;
      tImg.style.transform = 'perspective(1100px) rotateX(' + (-y * 6).toFixed(2) + 'deg) rotateY(' +
        (x * 8).toFixed(2) + 'deg) scale(1.02)';
      tiltStage.style.setProperty('--shx', (x * 100 + 50).toFixed(1) + '%');
      tiltStage.style.setProperty('--shy', (y * 100 + 50).toFixed(1) + '%');
    });
    tiltStage.addEventListener('pointerenter', function () { tiltStage.classList.add('tilting'); });
    tiltStage.addEventListener('pointerleave', function () {
      tiltStage.classList.remove('tilting');
      tImg.style.transform = '';
      tiltStage.style.setProperty('--shx', '50%');
      tiltStage.style.setProperty('--shy', '40%');
    });
  }


  /* ---------- theme: auto -> light -> dark, persisted ---------- */
  var THEME_KEY = 'bagged-up-theme';
  var themeBtn = $('#theme-btn');
  function savedTheme() {
    var t = null;
    try { t = storeGet(THEME_KEY); } catch { /* storage blocked - follow the OS */ }
    return (t === 'light' || t === 'dark') ? t : null;
  }
  function applyThemeLabel() {
    if (!themeBtn) return;
    var t = document.documentElement.getAttribute('data-theme');
    var mode = !t ? 'Auto (follows your device)' : (t === 'dark' ? 'Dark' : 'Light');
    themeBtn.title = 'Theme: ' + mode + ' (tap to change)';
    themeBtn.setAttribute('aria-label', 'Colour theme: ' + mode + '. Tap to change.');
  }
  function setTheme(next, persist) {
    if (next) document.documentElement.setAttribute('data-theme', next);
    else document.documentElement.removeAttribute('data-theme');
    if (persist) storeSet(THEME_KEY, next || '');
    applyThemeLabel();
  }
  if (themeBtn) {
    applyThemeLabel();
    themeBtn.addEventListener('click', function () {
      var cur = savedTheme();
      var osDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      var effective = cur || (osDark ? 'dark' : 'light');
      if (cur === null) {
        setTheme(effective === 'dark' ? 'light' : 'dark', true);       // auto -> explicit opposite
      } else if (cur === 'light' && osDark) {
        setTheme('dark', true);                                         // light -> dark
      } else if (cur === 'dark' && !osDark) {
        setTheme('light', true);                                        // dark -> light
      } else {
        setTheme(null, true);                                           // back to auto
      }
      var m = document.documentElement.getAttribute('data-theme');
      toast(m ? ('Theme: ' + (m === 'dark' ? 'Dark' : 'Light')) : 'Theme: Auto (following your device)');
    });
    /* if the OS switches while user is on auto, the media query handles it (pure CSS) */
  }

  /* ---------- lightbox (PDP photo viewer) ---------- */
  var lb = $('#lightbox');
  if (lb) {
    var lbImg = $('#lb-img');
    var lbCount = $('#lb-count');
    var lbThumbBtns = $all('#lb-thumbs button');
    var lbSrcs = lbThumbBtns.map(function (b) { return b.querySelector('img').getAttribute('src'); });
    var lbAlt = ($('#pdp-zoom img') || {}).alt || 'Product photo';
    var lbI = 0, lbLastFocus = null;

    function lbShow(i) {
      lbI = (i + lbSrcs.length) % lbSrcs.length;
      lbImg.src = lbSrcs[lbI];
      lbImg.alt = lbAlt + ', photo ' + (lbI + 1);
      lbCount.textContent = (lbI + 1) + ' / ' + lbSrcs.length;
      lbThumbBtns.forEach(function (b, j) { b.classList.toggle('active', j === lbI); });
      var act = lbThumbBtns[lbI];
      if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    function lbOpen(i) {
      lbLastFocus = document.activeElement;
      lb.classList.add('open');
      document.body.classList.add('no-scroll');
      lbShow(i);
      $('#lb-close').focus();
    }
    function lbClose() {
      lb.classList.remove('open');
      document.body.classList.remove('no-scroll');
      if (lbLastFocus) lbLastFocus.focus();
    }
    var zoom = $('#pdp-zoom');
    /* #pdp-zoom is a native <button>, so Enter/Space already fire click */
    zoom && zoom.addEventListener('click', function () { lbOpen(0); });
    $all('.thumbs button').forEach(function (btn, i) {
      btn.addEventListener('dblclick', function () { lbOpen(i); });
    });
    lbThumbBtns.forEach(function (btn, i) {
      btn.addEventListener('click', function () { lbShow(i); });
    });
    $('#lb-close').addEventListener('click', lbClose);
    $('#lb-prev').addEventListener('click', function () { lbShow(lbI - 1); });
    $('#lb-next').addEventListener('click', function () { lbShow(lbI + 1); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') lbClose();
      if (e.key === 'ArrowLeft') lbShow(lbI - 1);
      if (e.key === 'ArrowRight') lbShow(lbI + 1);
    });
    /* swipe */
    var tx = null;
    lb.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (tx === null) return;
      var dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 40) lbShow(lbI + (dx < 0 ? 1 : -1));
      tx = null;
    }, { passive: true });
  }

  /* ---------- sticky add to bag on product pages (Amazon pattern) ---------- */
  var pdpInfo = $('.pdp-info');
  if (pdpInfo) {
    var pdpAdd = pdpInfo.querySelector('[data-add]');
    var pdpSlug = pdpAdd && pdpAdd.getAttribute('data-add');
    var pdpNameEl = pdpInfo.querySelector('h1');
    var pdpName = pdpNameEl ? pdpNameEl.textContent.trim() : '';
    var pdpPriceEl = pdpInfo.querySelector('.pdp-price .amount');
    var pdpPrice = pdpPriceEl ? pdpPriceEl.textContent.trim() : '';
    var pdpImgEl = $('#pdp-main-img');
    var pdpImg = pdpImgEl ? pdpImgEl.getAttribute('src') : '';

    if (pdpAdd && pdpSlug) {
      var bar = document.createElement('div');
      bar.className = 'sticky-atc';
      bar.id = 'sticky-atc';
      bar.hidden = true;
      bar.innerHTML =
        '<img src="' + pdpImg + '" alt="" width="48" height="48" loading="lazy">' +
        '<div class="sa-txt">' +
          '<span class="sa-name">' + escHtml(pdpName) + '</span>' +
          '<span class="sa-price">' + escHtml(pdpPrice) + ' · ' + escHtml(deliveryEta().country) + '</span>' +
        '</div>' +
        '<button class="btn btn-solid" type="button" data-add="' + pdpSlug + '">Add to bag</button>';
      document.body.appendChild(bar);

      var showBar = function (on) {
        bar.hidden = !on;
        document.body.classList.toggle('has-sticky', on);
      };
      if (typeof IntersectionObserver === 'function') {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            showBar(!en.isIntersecting && en.boundingClientRect.top < 0);
          });
        }, { threshold: 0 }).observe(pdpAdd);
      } else {
        window.addEventListener('scroll', function () {
          showBar(pdpAdd.getBoundingClientRect().bottom < 0);
        }, { passive: true });
      }
    }

    /* product page delivery date, right under the button */
    var etaLine = document.createElement('p');
    etaLine.className = 'eta eta-pdp';
    etaLine.textContent = deliveryEtaLine();
    pdpAdd.parentNode.insertBefore(etaLine, pdpAdd.nextSibling);

    /* save this bag, next to the button (Etsy and Vinted pattern) */
    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-ghost saved-inline';
    saveBtn.setAttribute('data-save', pdpSlug);
    pdpAdd.parentNode.insertBefore(saveBtn, pdpAdd.nextSibling.nextSibling);

    /* remember what was viewed, and show the trail (Amazon pattern) */
    var watched = readList(RECENT_KEY).filter(function (r) { return r && r.slug && r.slug !== pdpSlug; });
    writeList(RECENT_KEY, [{ slug: pdpSlug, name: pdpName, price: pdpPrice, img: pdpImg }]
      .concat(watched).slice(0, 8));

    if (watched.length) {
      var anchor = document.querySelector('section[aria-label="You may also like"]') || document.querySelector('.pdp-info');
      var rail = document.createElement('section');
      rail.className = 'section';
      rail.setAttribute('aria-label', 'Recently viewed');
      rail.innerHTML =
        '<div class="container">' +
          '<div class="section-head"><div><span class="overline">Pick up where you left off</span>' +
          '<h2>Recently viewed</h2></div></div>' +
          '<div class="rail">' + watched.slice(0, 4).map(function (r) {
            return '<a class="rail-card" href="' + ROOT + 'shop/' + r.slug + '.html">' +
              '<img src="' + ROOT + (r.img || '').replace(/^\.\.\//, '') + '" alt="' + escHtml(r.name) + '" loading="lazy" width="160" height="160">' +
              '<span class="rail-name">' + escHtml(r.name) + '</span>' +
              '<span class="rail-price">' + escHtml(r.price) + '</span>' +
            '</a>';
          }).join('') + '</div>' +
        '</div>';
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(rail, anchor.nextSibling);
    }
  }

  /* ---------- saved items (Etsy and Vinted pattern) ---------- */
  function paintSaveButton(btn, on) {
    var name = btn.getAttribute('data-save-name') || 'this bag';
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (btn.classList.contains('saved-inline')) {
      btn.textContent = on ? 'Saved' : 'Save for later';
    } else {
      btn.setAttribute('aria-label', (on ? 'Remove from saved: ' : 'Save for later: ') + name);
    }
  }
  $all('.card').forEach(function (card) {
    var link = card.querySelector('a[href]');
    var slug = slugFromHref(link && link.getAttribute('href'));
    var product = slug && productBySlug(slug);
    if (!product) return;
    var heart = document.createElement('button');
    heart.type = 'button';
    heart.className = 'saved-btn';
    heart.setAttribute('data-save', slug);
    heart.setAttribute('data-save-name', product.name);
    paintSaveButton(heart, isSaved(slug));
    var media = card.querySelector('.card-media') || card;
    media.appendChild(heart);
  });
  $all('.saved-inline').forEach(function (btn) { paintSaveButton(btn, isSaved(btn.getAttribute('data-save'))); });

  document.addEventListener('click', function (e) {
    var btn = /** @type {Element} */ (e.target).closest('[data-save]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var slug = btn.getAttribute('data-save');
    var product = productBySlug(slug);
    var nowSaved = toggleSaved(slug);
    $all('[data-save="' + slug + '"]').forEach(function (b) { paintSaveButton(b, nowSaved); });
    if (product) toast(nowSaved ? 'Saved ' + product.name : 'Removed ' + product.name);
    document.dispatchEvent(new CustomEvent('bagged:saved'));
  });

  /* ---------- reviews (Amazon, Etsy: proof beside the thing being bought) ----------
     A review is one person's words. Name, date, rating and text are rendered as
     a single card so they cannot read as separate things, and the whole page set
     comes from window.BAGGED_UP_REVIEWS rather than from markup copied into 51
     files. */
  function starRow(rating) {
    var out = '';
    for (var i = 1; i <= 5; i++) {
      out += '<svg viewBox="0 0 24 24" aria-hidden="true" class="' + (i <= rating ? 'on' : 'off') + '">' +
        '<path d="m12 2.6 2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.05 1.1-6.5-4.7-4.6 6.5-.95L12 2.6Z"/></svg>';
    }
    return out;
  }
  function monthYear(iso) {
    var mo = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var parts = String(iso || '').split('-');
    if (parts.length < 2) return escHtml(iso || '');
    return mo[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
  }
  function reviewCard(r) {
    var product = r.product ? productBySlug(r.product) : null;
    var initial = (r.name || '?').trim().charAt(0).toUpperCase();
    return '<article class="review-item">' +
      '<div class="review-head">' +
        '<span class="review-avatar" aria-hidden="true">' + escHtml(initial) + '</span>' +
        '<span class="review-who">' +
          '<b>' + escHtml(r.name) + '</b>' +
          (r.verified ? '<span class="review-verified" title="Order confirmed">Verified order</span>' : '') +
          '<time datetime="' + escHtml(r.date) + '">' + monthYear(r.date) + '</time>' +
        '</span>' +
        '<span class="review-score" role="img" aria-label="' + r.rating + ' out of 5 stars">' + starRow(r.rating) + '</span>' +
      '</div>' +
      '<blockquote class="review-words">' + escHtml(r.body) + '</blockquote>' +
      (product ? '<p class="review-about">On the <a href="' + ROOT + 'shop/' + product.slug + '.html">' + escHtml(product.name) + '</a></p>' : '') +
    '</article>';
  }
  function reviewSummary(list) {
    if (!list.length) return '';
    var total = list.reduce(function (n, r) { return n + (r.rating || 0); }, 0);
    var avg = (total / list.length).toFixed(1);
    return '<p class="review-summary">' +
      '<span class="review-score" role="img" aria-label="Average ' + avg + ' out of 5">' + starRow(Math.round(total / list.length)) + '</span>' +
      '<span><b>' + avg + '</b> average from ' + list.length + ' review' + (list.length === 1 ? '' : 's') +
      ', all from delivered orders</span>' +
    '</p>';
  }

  $all('[data-reviews]').forEach(function (host) {
    var slug = host.getAttribute('data-reviews');
    var list = slug === 'all'
      ? REVIEWS.slice()
      : REVIEWS.filter(function (r) { return r.product === slug; });
    var empty = host.getAttribute('data-reviews-empty') || 'No reviews yet for this piece. Be the first.';
    var intro = host.querySelector('[data-reviews-keep]');
    var body = list.length
      ? reviewSummary(list) + list.map(reviewCard).join('')
      : '<p class="review-empty">' + escHtml(empty) + '</p>';
    if (intro) {
      intro.insertAdjacentHTML('afterend', body);
    } else {
      host.insertAdjacentHTML('afterbegin', body);
    }
    host.setAttribute('data-reviews-ready', 'true');
  });

  /* ---------- init ---------- */
  updateBadge();
})();
