/* ============================================================
   Bagged Up — storefront behaviour
   Cart (localStorage) · Nav overlay · Toasts · Shop filters
   PDP gallery · Review form UX · WhatsApp checkout
   ============================================================ */
(function () {
  'use strict';

  var DEPTH = (Number(document.documentElement.dataset.depth) || 0);
  var ROOT = DEPTH === 0 ? '' : new Array(DEPTH + 1).join('../');
  var PRODUCTS = window.BAGGED_UP_PRODUCTS || [];
  var WA_NUMBER = '254113599345';
  var CART_KEY = 'bagged-up-cart-v1';
  var DELIVERY_KEY = 'bagged-up-delivery-v1';

  /* Storage can throw in sandboxed/opaque-origin frames — never let it break
     the storefront; degrade gracefully to in-memory */
  var mem = {};
  function storeGet(k) {
    try { return window.localStorage.getItem(k); } catch (e) { return (k in mem) ? mem[k] : null; }
  }
  function storeSet(k, v) {
    try { window.localStorage.setItem(k, v); } catch (e) { mem[k] = v; }
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
    } catch (e) { return {}; }
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
    if (p) toast('Added to bag — ' + p.name);
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
    var btn = e.target.closest('[data-add]');
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

    function applyShop() {
      var cat = (chips.filter(function (c) { return c.classList.contains('active'); })[0] || {}).getAttribute('data-cat') || 'all';
      var cards = $all('.card', shopGrid);
      var visible = 0;
      cards.forEach(function (card) {
        var show = cat === 'all' || card.getAttribute('data-cat') === cat;
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
      if (note) note.textContent = visible + ' piece' + (visible === 1 ? '' : 's') + (cat === 'all' ? '' : ' in this edit');
    }
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
        toast('Please add your name and a rating first.');
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
        '<div class="row"><span class="muted">Delivery' + (fee === 0 ? ' — on us' : '') + '</span>' +
          '<span>' + (fee === 0
            ? '<span class="free-tag">Free</span>&nbsp;<span class="strike">' + money(opt.fee) + '</span>'
            : money(fee)) + '</span></div>' +
        (subtotal < FREE_DELIVERY_OVER
          ? '<div class="row" style="font-size:.8rem"><span class="muted">Free delivery from ' + money(FREE_DELIVERY_OVER) + '</span><span></span></div>'
          : '') +
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
        return (i + 1) + '. ' + p.name + ' × ' + cart[slug] + ' — ' + money(p.price * cart[slug]);
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
      var line = e.target.closest('.cart-line');
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
    var btn = e.target.closest('[data-copy-order]');
    if (!btn) return;
    var pre = $('#wa-msg-preview');
    var text = pre ? pre.textContent : '';
    if (!text) { toast('Nothing to copy yet — add something to your bag first.'); return; }
    function done() { toast('Order copied — paste it into WhatsApp.'); }
    function fail() { toast('Could not copy automatically — long-press the message to copy.'); }
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
      } catch (err) { return false; }
    }
    /* sync path first — the async clipboard API can stay pending forever
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
         that is always on screen — if even that never "intersects", IO is
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
    } catch (e) { revealAll(); }
  }

  /* ---------- card second image on first hover ---------- */
  var canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (canHover) {
    document.addEventListener('pointerover', function (e) {
      var media = e.target.closest('.card-media[data-alt-src]');
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
  var tiltStage = document.querySelector('.pdp-gallery .tilt');
  if (tiltStage && canHover && !reduced) {
    var tImg = tiltStage.querySelector('img');
    tiltStage.addEventListener('pointermove', function (e) {
      var r = tiltStage.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
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

  /* ---------- init ---------- */
  updateBadge();
})();
