/* Reviews, in one place.
   A review belongs to a person, so name, date, rating and words are stored and
   rendered together rather than as fragments that can drift apart. `product` is
   the slug the review is about, or null for a review of the shop itself.
   `app.js` reads this back off window.BAGGED_UP_REVIEWS and renders the cards. */
/* Reviews, in one place. A review belongs to a person, so the name, the date,
   the rating and the words are stored and rendered together rather than as
   fragments that can drift apart. `product` is the slug the review is about,
   or null for a review of the shop itself. */
window.BAGGED_UP_REVIEWS = [
  {
    "name": "Millicent",
    "date": "2026-09",
    "rating": 5,
    "product": null,
    "body": "Good customer service, thank you!",
    "verified": true
  }
];
