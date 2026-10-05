/* Type surface for the plain-script storefront (JS, no modules, no bundler).
   `assets/js/data.js` is generated externally and assigns the catalogue to
   window.BAGGED_UP_PRODUCTS; `app.js` reads it back. */
interface BaggedUpProduct {
  slug: string;
  name: string;
  price: number;
  category: string;
  images: string[];
}

interface Window {
  BAGGED_UP_PRODUCTS?: BaggedUpProduct[];
}

/* A review belongs to a person and to a product, or to no product when it is
   about the shop itself. */
interface BaggedUpReview {
  name: string;
  date: string;
  rating: number;
  product: string | null;
  body: string;
  verified?: boolean;
}

interface Window {
  BAGGED_UP_REVIEWS?: BaggedUpReview[];
}
