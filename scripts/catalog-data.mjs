// Evara Studios catalog, transcribed from "Website Requirement List.pdf".
// Names, descriptions, options, prices and specifications are exactly as supplied.
// Nothing here is invented: categories without documented products are seeded
// empty, and collections are seeded without products.

/** Top-level and nested categories, in the order given in the brief. */
export const categories = [
  {
    name: "Jar Candles",
    image: "products/sunflower/sunflower-bowl-jar-candles.jpeg",
    children: [
      { name: "Shot Glass Candles", image: "products/fruit/strawberry.jpeg" },
      { name: "Bowl Jar Candles", image: "products/daisy/daisy-bowl-jar-candles.jpeg" },
      { name: "Large Glass Jar Candles" },
      { name: "Metal Jar Candles" },
      { name: "Metal Urlis" },
      { name: "T Light Candles" },
      { name: "Concrete Jar Candles", comingSoon: true },
    ],
  },
  { name: "Mould Candles" },
  { name: "Wax Sachets" },
  { name: "Wax Melts" },
  { name: "Candle Bouquets" },
  { name: "Hampers", comingSoon: true },
  { name: "Concrete Containers", comingSoon: true },
  { name: "Diffusers", comingSoon: true },
  { name: "DIY Kits", comingSoon: true },
];

export const collections = [
  "Dessert Candles",
  "Baby Shower",
  "Valentine’s Special",
  "Ganesh Utsav",
  "Diwali Collection",
  "Christmas Collection",
];

/**
 * Cover photos for the collection cards. No collection photography was
 * supplied, so these reuse the supplied candle photos as stand-ins until the
 * real ones are uploaded in Admin -> Collections. Keys are collection slugs.
 */
export const collectionImages = {
  "dessert-candles": "products/velvet/coffee-latte.jpeg",
  "baby-shower": "products/daisy/daisy-powder-blue.jpeg",
  "valentines-special": "products/floral/rose-peony.jpeg",
  "ganesh-utsav": "products/floral/mogra-buds.jpeg",
  "diwali-collection": "homepage/home-3.jpeg",
  "christmas-collection": "products/fruit/raspberry.jpeg",
};

const BOWL_PACKS = [
  { label: "Single Piece", pack: 1, compareAt: 350, price: 299 },
  { label: "Set of 2", pack: 2, compareAt: 680, price: 579 },
];
const BOWL_SPECS = [
  { label: "Dimensions", value: "7.5 cm diameter x 4.7 cm height" },
  { label: "Wax Weight", value: "Approx. 85-95 g" },
  { label: "Burn Time", value: "Approx. 18-20 hours" },
];

const SHOT_PACKS = [
  { label: "Single Piece", pack: 1, compareAt: 200, price: 150 },
  { label: "Set of 2", pack: 2, compareAt: 380, price: 285 },
  { label: "Set of 4", pack: 4, compareAt: 740, price: 555 },
  { label: "Set of 6", pack: 6, compareAt: 1080, price: 810 },
];
const SHOT_SPECS = [
  { label: "Dimensions", value: "6 cm diameter x 5.6 cm height" },
  { label: "Wax Weight", value: "Approx. 55-65 g" },
  { label: "Burn Time", value: "Approx. 10-12 hours" },
];

/** A value written as { value, comingSoon: true } is listed but cannot be ordered. */
const soon = (value) => ({ value, comingSoon: true });

/**
 * images: file is relative to supabase/seed-assets; `link` ties a photo to an
 * option value (shown when the customer picks it); `gallery` puts it in the
 * homepage gallery.
 */
export const products = [
  {
    name: "Daisy Bowl Jar Candle",
    category: "Bowl Jar Candles",
    description:
      "A delicate daisy bloom, handcrafted in wax and nestled in a clear glass bowl - a graceful blend of artistry, fragrance and understated elegance.",
    options: [
      { name: "Hue", kind: "colour", values: ["Blush Pink", "Powder Blue", "Butter Yellow", "Lilac Mist"] },
      {
        name: "Scent",
        kind: "fragrance",
        values: ["Rose Boost", "Jasmine", "Lily of the Valley", "Lavender", "Aloe Vera", "Summer Breeze", "White Musk", "Bamboo & White Tea"],
      },
    ],
    packs: BOWL_PACKS,
    specifications: BOWL_SPECS,
    images: [
      { file: "products/daisy/daisy-bowl-jar-candles.jpeg", alt: "Daisy Bowl Jar Candles in four hues", gallery: true },
      { file: "products/daisy/daisy-blush-pink.jpeg", alt: "Daisy Bowl Jar Candle in Blush Pink", link: "Blush Pink" },
      { file: "products/daisy/daisy-powder-blue.jpeg", alt: "Daisy Bowl Jar Candle in Powder Blue", link: "Powder Blue", gallery: true },
      { file: "products/daisy/daisy-butter-yellow.jpeg", alt: "Daisy Bowl Jar Candle in Butter Yellow", link: "Butter Yellow" },
      { file: "products/daisy/daisy-lilac-mist.jpeg", alt: "Daisy Bowl Jar Candle in Lilac Mist", link: "Lilac Mist" },
      { file: "products/daisy/daisy-dimensions.jpeg", alt: "Daisy Bowl Jar Candle dimensions: 7.5 cm diameter, 4.7 cm height" },
    ],
  },
  {
    name: "Sunflower Bowl Jar Candle",
    category: "Bowl Jar Candles",
    description:
      "A radiant sunflower bloom, handcrafted in wax and nestled in a clear glass bowl - a cheerful blend of artistry, warmth and understated elegance.",
    options: [
      { name: "Hue", kind: "colour", values: ["Classic Yellow", "Ivory", "Warm Orange"] },
      { name: "Scent", kind: "fragrance", values: ["Jasmine", "Lily of the Valley", "Summer Breeze", "White Musk"] },
    ],
    packs: BOWL_PACKS,
    specifications: BOWL_SPECS,
    images: [
      { file: "products/sunflower/sunflower-bowl-jar-candles.jpeg", alt: "Sunflower Bowl Jar Candles in three hues", gallery: true },
      { file: "products/sunflower/sunflower-classic-yellow.jpeg", alt: "Sunflower Bowl Jar Candle in Classic Yellow", link: "Classic Yellow" },
      { file: "products/sunflower/sunflower-ivory.jpeg", alt: "Sunflower Bowl Jar Candle in Ivory", link: "Ivory", gallery: true },
      { file: "products/sunflower/sunflower-warm-orange.jpeg", alt: "Sunflower Bowl Jar Candle in Warm Orange", link: "Warm Orange" },
      { file: "products/sunflower/sunflower-dimensions.jpeg", alt: "Sunflower Bowl Jar Candle dimensions: 7.5 cm diameter, 4.7 cm height" },
    ],
  },
  {
    name: "Fruit Shot Glass Candle",
    category: "Shot Glass Candles",
    description:
      "Inspired by nature’s sweetest treasures, this collection transforms familiar fruits into beautifully crafted candles – vibrant in color, delightful in character and made to brighten up your space.",
    options: [
      {
        name: "Design",
        kind: "design",
        values: ["Blueberry", "Strawberry", "Raspberry", "Mango", soon("Orange"), soon("Green Apple")],
      },
    ],
    packs: SHOT_PACKS,
    specifications: SHOT_SPECS,
    images: [
      { file: "products/fruit/blueberry.jpeg", alt: "Blueberry Fruit Shot Glass Candles", link: "Blueberry", gallery: true },
      { file: "products/fruit/strawberry.jpeg", alt: "Strawberry Fruit Shot Glass Candles", link: "Strawberry" },
      { file: "products/fruit/raspberry.jpeg", alt: "Raspberry Fruit Shot Glass Candles", link: "Raspberry" },
      { file: "products/fruit/mango.jpeg", alt: "Mango Fruit Shot Glass Candles", link: "Mango", gallery: true },
    ],
  },
  {
    name: "Velvet Shot Glass Candle",
    category: "Shot Glass Candles",
    description:
      "An ode to rich, comforting fragrances, the Velvet Collection brings together indulgent aromas that evoke warmth, depth and quiet luxury – crafted for moments of slow living and lingering pleasure.",
    options: [{ name: "Design", kind: "design", values: ["Coffee Latte", "Tobacco Noir", soon("Chocolate Perf")] }],
    packs: SHOT_PACKS,
    specifications: SHOT_SPECS,
    images: [
      { file: "products/velvet/coffee-latte.jpeg", alt: "Coffee Latte Velvet Shot Glass Candles", link: "Coffee Latte", gallery: true },
      { file: "products/velvet/tobacco-noir.jpeg", alt: "Tobacco Noir Velvet Shot Glass Candles", link: "Tobacco Noir" },
    ],
  },
  {
    name: "Floral Shot Glass Candle",
    category: "Shot Glass Candles",
    description:
      "Inspired by nature’s sweetest beauty, this collection transforms aromatic flowers into beautifully crafted candles – vibrant in color, delightful in character and made to brighten up your space.",
    options: [
      { name: "Design", kind: "design", values: ["Rose Peony", "Mogra Buds"] },
      {
        name: "Hue",
        kind: "colour",
        values: ["Classic Red", "Blush Pink", "Burgundy", "Lavender", "Warm Orange", "Classic Yellow", "Sage Green", "Aqua Blue"],
      },
      {
        name: "Scent",
        kind: "fragrance",
        values: [
          "Rose Boost", "Jasmine", "Lily of the Valley", "Lavender", "Royal Kashmiri", "Bouquet",
          soon("Plumeria"), soon("Marigold"), soon("Lotus"), soon("Gucci Flora"),
        ],
      },
    ],
    packs: SHOT_PACKS,
    specifications: SHOT_SPECS,
    images: [
      { file: "products/floral/rose-peony.jpeg", alt: "Rose Peony Floral Shot Glass Candles", link: "Rose Peony", gallery: true },
      { file: "products/floral/mogra-buds.jpeg", alt: "Mogra Buds Floral Shot Glass Candles", link: "Mogra Buds", gallery: true },
    ],
  },
];

export const heroSlides = [
  { file: "homepage/home-1.jpeg", alt: "Four daisy bowl jar candles in pastel hues" },
  { file: "homepage/home-3.jpeg", alt: "A lit jar candle on a warm, softly lit table" },
  { file: "homepage/home-2.jpeg", alt: "Enjoying the fragrance of a lit candle" },
  { file: "homepage/home-4.jpeg", alt: "Wax being poured by hand into glass jars" },
];

// Names are taken from the supplied photo file names.
export const founders = [
  { file: "founders/neehal.jpeg", name: "Neehal" },
  { file: "founders/tanishq.jpeg", name: "Tanishq" },
];

export const foundersStory = `Sometimes, life just doesn’t go the way you thought it would. And honestly, that’s how Evara happened.

We were two people stuck in the never-ending CA journey, giving attempts, doing articleship and constantly wondering, “Okay, but what do we actually want to do with our lives?”

One thing we always knew though, we were lowkey obsessed with pretty spaces, aesthetic home decor, calming vibes and anything that could make a space feel a little more special. We’ve always loved that whole premium, cozy, good-vibes-only kind of aesthetic.

And then we discovered candles.

It started with watching way too many candle-making reels, even more than our CA lectures and randomly ordering a candle-making kit from Amazon. We made our first candle, a simple hexagonal jar candle, and honestly... it turned out pretty damn good.

That was the moment we thought, “Wait a minute... can we actually do this?”

So we went for it.

We took a course, learned the process, experimented like crazy, taught each other whatever we figured out, made a LOT of mistakes, tried again and slowly started getting better.

What started as a random little idea somehow became something we genuinely enjoyed. And before we even realized it, that little experiment had turned into Evara Studios.

Today, Evara is so much more than just candles for us. It’s basically a little piece of everything we love: creativity, aesthetics, warmth, good design and those tiny details that just make you go, “Okayyy, this is cute.”

And whenever we look at that first hexagonal jar, we’re reminded of where it all started. Because sometimes, you don’t need to have your whole life figured out. Sometimes, you just need to try one random thing that makes you happy. And who knows... that one thing might just become your thing.

Welcome to Evara Studios,
Light that lingers within.`;

export function slugify(input) {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
