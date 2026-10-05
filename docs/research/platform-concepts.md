# What the proven platforms do, and what we should borrow

Ten platforms that solve the same problems this shop has, the concepts worth
taking from each, and where each one lands in this repo. Every claim about a
platform is linked to a source. Where a number is reported by a vendor or a case
study rather than a controlled test, it is labelled as reported.

The rule for borrowing: a concept earns a place only if it either removes
friction for a buyer on a phone with a slow connection, or removes a reason to
distrust a shop that takes payment on delivery. Anything that only looks
impressive is left out.

## The ten, and what to take from each

### 1. Amazon

Trained buyers to expect a date, not a speed. Delivery is quoted as a concrete
day, reviews sit near the buy action with photos, and a recommendation rail
follows every product.

- **Borrow: concrete delivery dates.** "Arrives Tuesday" beats "2 to 3 days".
  The 2026 product page research puts delivery estimate messaging in the
  highest leverage group, and reports that 75% of shoppers say a date helps them
  decide ([Digital Applied](https://www.digitalapplied.com/blog/ecommerce-product-page-optimization-2026-conversion-framework)).
- **Borrow: review summary near the title, not in a tab.** Moving the star
  summary and two review snippets below the add-to-cart button is reported to
  lift conversion 18 to 31% across eight stores tested
  ([PXLPeak](https://pxlpeak.com/blog/web-design/best-ecommerce-website-designs-2026)).
  Only worth doing with real reviews, so this waits for owner content.
- **Borrow: a recommendation rail.** "Customers also bought" is reported to
  raise order value 12 to 31%, and it is the cheapest cross-sell that exists
  because it needs no new copy ([PXLPeak](https://pxlpeak.com/blog/web-design/best-ecommerce-website-designs-2026)).
- **Skip: fake urgency.** No invented stock counters or "3 people are viewing".

### 2. Etsy

A discovery engine built on structured attributes, not just categories and a
search box.

- **Borrow: the five filter types buyers expect.** Category, price, brand,
  rating and one product-specific trait. Baymard's product list research found
  57% of stores are missing at least one of them
  ([Save to Wishlist](https://savetowishlist.com/ecommerce-shop-page-best-practices-wishlist/)).
  For us: shape, price band, colour family, and availability.
- **Borrow: filters you can see and undo.** 28% of sites do not show which
  filters are active. Applied filters should be removable chips above the grid
  ([Save to Wishlist](https://savetowishlist.com/ecommerce-shop-page-best-practices-wishlist/)).
- **Borrow: favourites on every card.** A wishlist button on each product card,
  not only on the product page
  ([Save to Wishlist](https://savetowishlist.com/ecommerce-shop-page-best-practices-wishlist/)).
- **Borrow: structured attributes feed the filters.** A free-text variation is
  invisible to filtered search; the structured field is what the filter reads
  ([Listing Loom](https://www.listingloom.app/blog/etsy-search-filters-that-hide-your-listing)).
  This is the argument for putting shape, colour and material in `data.js` as
  fields rather than only in prose.
- **Skip: infinite scroll** on a shop page built for narrowing down.

### 3. Shopify

Not the platform for us, but its defaults are the industry norm for one reason:
they were A/B tested at enormous scale.

- **Borrow: cart and checkout stay one page, fields stay few, guest by default.**
  One-page checkouts are reported to run 5 to 10% lower abandonment than
  multi-step ones, and mobile carts abandon at 80 to 85%
  ([Zipchat](https://www.zipchat.ai/blog/shopify-abandoned-cart-recovery),
  [Shopify](https://www.shopify.com/enterprise/blog/44272899-how-to-reduce-shopping-cart-abandonment-by-optimizing-the-checkout)).
- **Borrow: a cart link that can be shared and restored.** Shopify ties
  recovery to a per-cart URL
  ([CartBoss](https://www.cartboss.io/blog/shopify-abandoned-cart-url/)). A
  static site can do the same thing with the cart encoded in the URL fragment,
  which also lets a buyer send her cart to a friend on WhatsApp.
- **Borrow: variant swatches rather than dropdowns.** Swatches show the options
  instead of hiding them ([PXLPeak](https://pxlpeak.com/blog/web-design/best-ecommerce-website-designs-2026)).
- **Skip: email capture as the only recovery channel.** Kenyan commerce runs on
  WhatsApp, so recovery should run through the number we already have.

### 4. WhatsApp Business catalog

The channel most Kenyan buyers actually use, and the one this shop already
closes orders on.

- **Borrow: collections, not one flat list.** Roughly 70% of small catalogs
  studied had no collections at all; collections let one product sit under
  several angles at once
  ([Mursa](https://www.mursa.me/blog/whatsapp-business-catalog)).
- **Borrow: show prices.** Visible pricing cut enquiry volume by about 40% and
  raised enquiry-to-sale by about 60% in that study, for a net gain of roughly
  15% ([Mursa](https://www.mursa.me/blog/whatsapp-business-catalog)). The site
  already shows prices; the catalog should match it exactly.
- **Borrow: language that admits what the tool is not.** WhatsApp Business
  handles conversation, not compliant sales records; the guide is blunt that a
  POS has to sit behind it
  ([VeiraHQ](https://veirahq.com/blog/whatsapp-business-download-setup-kenya/)).
  Worth the owner knowing before building a workflow on it.
- **Confirm: description length.** Catalog copy should stay under about 100
  words while still carrying size, material and the selling point
  ([Splashify](https://splashifypro.com/blog/how-to-sell-on-whatsapp-store-catalog-setup)).
  That is the same constraint the 50 supplier descriptions are waiting on.
- **Note: 65% of shoppers say they are more likely to buy from a business they
  can message directly** ([JuaTech](https://juatechafrica.com/tech-decoded/tech-guides-how-to/whatsapp-business-for-kenyan-entrepreneurs-and-smes/)).
  We already have the button; the catalog is the missing half.

### 5. Instagram and TikTok Shop

Commerce at the point of inspiration, with the product tag doing the work.

- **Borrow: tag the product in the content that shows it.** Shoppable posts and
  Reels put the item one tap from the video
  ([Stagebit](https://stagebit.com/blog/social-commerce/),
  [TrendlyPost](https://www.trendlypost.com/social-commerce-trends-2026/)).
  Concretely: every product page should offer the shop's own post for that bag
  where one exists.
- **Borrow: short vertical video on the product page.** Video is repeatedly
  listed as a high impact, high effort PDP element that most stores skip
  ([Digital Applied](https://www.digitalapplied.com/blog/ecommerce-product-page-optimization-2026-conversion-framework)).
  The stylesheet already has a `.pdp-video` block with no player behind it, so
  the slot exists and is empty.
- **Borrow: user photos.** Photo reviews are reported at 21 to 29% lift
  ([Digital Applied](https://www.digitalapplied.com/blog/product-page-optimization-ecommerce-conversion-guide-2026)).
  Again: real photos only, so it waits on owner content.
- **Skip: urgency drops and live selling.** They work, they are not this shop's
  format yet, and a poorly run one costs more trust than it earns.

### 6. Jumia Kenya

The reference for how payment and delivery have to be framed in this market.

- **Borrow: pay on delivery stays prominent.** It is the trust mechanism for
  first time buyers, and sites that refuse it lose them
  ([Nelium](https://neliumsystems.com/best-ecommerce-website-examples-kenya/)).
  We already support it; the product page should say so next to the button.
- **Borrow: M-Pesa as the default, not an alternative.** Kenyan abandonment is
  materially higher when M-Pesa is not the first option, and one analysis puts
  the conversion cost of not having STK push at 30 to 50%
  ([Nelium](https://neliumsystems.com/best-ecommerce-website-examples-kenya/)).
  Today the site closes on WhatsApp and asks for M-Pesa there. If the owner ever
  wants online payment, STK push is the first integration, not cards.
- **Borrow: pickup and delivery windows.** Jumia's pay-on-delivery terms are
  city-specific with an amount cap and exact-change rules
  ([Venas News](https://venasnews.co.ke/2020/04/14/jumia-kenya-payment-methods/)).
  Our delivery copy should name the towns and the windows the same way.
- **Borrow: a lightweight mobile build for expensive data.** Jumia's PWA
  reported 33% higher conversion and 50% lower bounce in exactly these network
  conditions ([MobiLoud](https://www.mobiloud.com/blog/progressive-web-app-examples/)).

### 7. Vinted

Second hand fashion at scale, with trust built into the mechanics.

- **Borrow: bundling.** Vinted lets a seller group items into a single listing,
  and buyers shop in bundles
  ([Nifty](https://nifty.ai/post/depop-vs-vinted)). For us: a small incentive to
  take two bags, which suits a shop whose delivery fee is the main friction.
- **Borrow: a saved items list.** Everything a buyer saves lives in one place
  ([Closo](https://closo.co/blogs/platform-specific-guides/how-does-vinted-work-2)).
- **Borrow: say what protection the buyer has.** Vinted's pitch is payment held
  until receipt plus buyer protection
  ([Closo](https://closo.co/blogs/platform-specific-guides/how-does-vinted-work-2)).
  We cannot hold payment, so the honest equivalent is a written answer to "what
  if it is not what I expected", linked from the product page.
- **Borrow: ratings and feedback.** Vinted leans on seller ratings and reviews
  to carry trust ([Atop Legal](https://atoplegal.com/vinted-vs-depop/)).

### 8. Depop

The social, style-led end of resale, and the closest analogue to a curated
preloved bag shop.

- **Borrow: offers as a normal part of buying.** Haggling is expected on Depop
  ([Nifty](https://nifty.ai/post/depop-vs-vinted)). A "make an offer" WhatsApp
  deep link costs nothing and moves that conversation out of the DMs.
- **Borrow: discovery by style, not only by category.** Depop is feed and
  follower led, Vinted is search led
  ([Nifty](https://nifty.ai/post/depop-vs-vinted)). We have categories; the
  missing layer is occasion and shape based browsing, which is what a buyer
  actually has in mind.
- **Borrow: the seller story.** A resale shop's credibility comes from who is
  behind it ([VervAunt](https://vervaunt.com/best-designed-dtc-ecommerce-websites)).
  The about page exists; nothing links the bags to it.
- **Skip: an algorithmic feed.** With 50 products, a good filter beats a feed.

### 9. Polène, Songmont and Mansur Gavriel

Three bag brands with proven product pages. Their discipline is answering size
questions before they are asked.

- **Borrow: capacity guidance in human terms.** Songmont describes what fits:
  a phone, an 11 inch iPad, a 13 inch laptop, and sizes collections accordingly
  ([Songmont](https://songmontofficial.com/collections/gather-collection),
  [Ashley Dudarenok](https://ashleydudarenok.com/songmont/)).
- **Borrow: multi-way carry stated plainly.** Handheld, shoulder, crossbody, and
  which straps come off ([Songmont](https://songmontofficial.com/collections/gather-collection)).
- **Borrow: material ageing as a feature, not a flaw.** Full grain leather that
  takes on a patina is a selling point for preloved goods
  ([Ashley Dudarenok](https://ashleydudarenok.com/songmont/)). Our catalogue has
  the material only in prose, if at all.
- **Borrow: personalisation as an upsell.** Mansur Gavriel's monogram flow with
  a live preview is cited as a strong upsell
  ([VervAunt](https://vervaunt.com/best-designed-dtc-ecommerce-websites)). A bag
  charm or a gift note is the realistic version for this shop.
- **Borrow: collection pages that tell the story.** The Gather collection page
  sells the material and the intent before the grid
  ([Songmont](https://songmontofficial.com/collections/gather-collection)).

### 10. PWA first mobile storefronts (Flipkart, Starbucks, Alibaba, Jumia)

The pattern for markets where data is expensive and storage is tight, which is
this market.

- **Borrow: install to home screen with no app store.** Flipkart Lite was
  reported at 70% higher conversion and 40% higher re-engagement, and Starbucks
  reached web orders near parity with its app
  ([MobiLoud](https://www.mobiloud.com/blog/progressive-web-app-examples/)).
- **Borrow: browse offline, sync later.** Starbucks allows browsing and building
  an order offline ([MobiLoud](https://www.mobiloud.com/blog/progressive-web-app-examples/)).
  A cached catalogue means a buyer can look at bags on a bus and order when
  signal returns.
- **Borrow: repeat visits load instantly.** Pre-cached shells load 2 to 3 times
  faster on average ([Xavier Kain](https://xavierkain.fr/en/blog/pwa-progressive-web-app-guide)).
- **And the measurement layer that makes it count: Core Web Vitals.** LCP under
  2.5s, INP under 200ms, CLS under 0.1, and only about 62% of mobile pages pass
  LCP. Oversized images are the usual cause, and lazy loading the hero image is
  actively harmful
  ([SEO Kreativ](https://www.seo-kreativ.de/en/blog/core-web-vitals-optimizing/),
  [Elevate](https://elevate-digital-solutions.com/page-experience-update-core-web-vitals/)).
  Image work is reported as the single largest win, one pass taking LCP from
  about 4s to about 2.2s on audited stores
  ([Elevate](https://elevate-digital-solutions.com/page-experience-update-core-web-vitals/)).

## What lands where in this repo

Borrowed concepts, mapped to actual files, ordered by impact against effort.

### Now

| Concept | From | Change |
| --- | --- | --- |
| Responsive images, modern format, honest dimensions | PWA/CWV | generate 400 and 800 wide variants, `<picture>` with WebP, real `width`/`height`, lazy below the fold, `fetchpriority` on the hero. Today the product page declares 1000x1175 for an 800x800 file |
| Sticky add-to-cart on mobile product pages | Amazon, PDP research | slim bar with thumbnail, name, price, button, appearing on scroll past the main button |
| Concrete delivery estimate | Amazon, Jumia | next business days with a cut-off hour, computed in the browser, shown on the product page and in the cart |
| Trust lines next to the button | Jumia, Vinted, Kenyan market research | pay on delivery, WhatsApp support, Nairobi dispatch, returns window, in one small block by the CTA |
| Free delivery progress in the cart | Shopify, Convert Cart | shows how far the buyer is from KSh 5,000, which the checkout already calculates |
| Shop filters with counts and removable chips | Etsy, Baymard | price bands, multi-select shapes, availability, applied chips, live result count |
| Saved items | Etsy, Vinted | heart on every card and product page, kept in `localStorage` like the cart |
| Recently viewed rail | Amazon | last four products seen, on the product page and the shop page |
| Shareable cart link | Shopify permalink | cart encoded in the URL fragment so it can be sent on WhatsApp |
| Related bags on the product page | Amazon | same category, same price band, excludes the current item |

### Next

| Concept | From | Change |
| --- | --- | --- |
| Installable PWA with offline catalogue | Flipkart, Starbucks, Jumia | `manifest.webmanifest` plus a service worker that caches the shell, the stylesheet and the catalogue data |
| Product video | TikTok Shop, PDP research | wire the existing empty `.pdp-video` block to clips the owner supplies |
| Specs and capacity accordion | Songmont, Polène | dimensions, what fits, strap options, material, care. Needs owner facts |
| WhatsApp catalogue mirror | WhatsApp Business | collections that match the site categories, prices identical, copy under 100 words. Owner action with a kit from me |
| Make an offer | Depop | WhatsApp deep link with the product and a suggested opening |
| Bundle incentive | Vinted | a real, stated saving for two bags, since delivery is the friction |
| Social tags per product | Instagram, TikTok | link the shop's post for that bag where one exists |
| Reviews near the buy action | Amazon, Etsy | needs real reviews and photos from the owner |

### Later

| Concept | From | Change |
| --- | --- | --- |
| Measurement | Shopify, CWV | privacy-friendly analytics plus Core Web Vitals field data, so changes can be judged rather than argued |
| Catalogue generated from one source | Shopify, Etsy attributes | shape, colour, material and dimensions as fields in `data.js`, with filters and structured data derived from them |
| M-Pesa STK push | Jumia | only if the owner wants online payment. Needs a till or paybill and a payment provider |
| Limited drops | TikTok Shop | needs inventory discipline and a reason to hurry that is real |

## What we will not copy

- Fake urgency: invented viewer counts, countdown timers, "only 2 left" that is
  not true.
- Infinite scroll on a 50 product shop.
- Account creation or email capture as a gate before buying.
- App install walls.
- Upsells that block the way to checkout.
- Dark patterns around delivery fees: our fees are shown before the cart, and
  they stay that way.

## What only the owner can supply

1. Real reviews and customer photos, with permission to publish.
2. Short clips of each bag for the product video slot.
3. Dimensions, material, care and what fits, for the specs accordion and the
   supplier descriptions already queued.
4. The WhatsApp Business catalogue setup, mirroring the site categories.
5. The Instagram and TikTok accounts to link, and which post shows which bag.
6. M-Pesa till or paybill details, if they should ever appear on the site.
7. A decision on hosting, which is still the blocker for seeing any of this
   deployed.
