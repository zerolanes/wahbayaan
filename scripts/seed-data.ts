/**
 * Seed content.
 *
 * BASE  — real structure every install needs (taxonomy, roles, FAQ, policy
 *         drafts, rate tables with every rate `pending`).
 * DEMO  — fictional artisans, listings, reviews and orders so the product can
 *         be explored before real artisans are onboarded. Every demo row is
 *         flagged `is_demo`, hidden unless DEMO_MODE=true, and the storefront
 *         shows a "demo content" ribbon whenever it is visible.
 */

export const CATEGORIES = [
  {
    slug: "calligraphy-art",
    name: "Calligraphy Art",
    tagline: "Nastaliq, Thuluth and Kufic — written by hand",
    description:
      "Original calligraphy on hand-prepared paper, wood and canvas: verses, names and single words, often finished with gold leaf and ebru-marbled margins.",
    art: "calligraphy",
    seed: 11,
  },
  {
    slug: "paintings",
    name: "Paintings",
    tagline: "Truck art, miniature and contemporary work",
    description:
      "From the riotous florals of Karachi's truck-art painters to the fine brushwork of the miniature tradition — original paintings signed by the artist.",
    art: "truckart",
    seed: 21,
  },
  {
    slug: "rugs",
    name: "Handmade Carpets & Rugs",
    tagline: "Hand-knotted wool, knot by knot",
    description:
      "Hand-knotted rugs in wool and silk — Bukhara guls, Balochi tribal designs and fine-knot revivals — made on vertical looms by weaving families.",
    art: "rug",
    seed: 31,
  },
  {
    slug: "sculpture-stone",
    name: "Sculpture & Stone",
    tagline: "Taxila carving in the Gandhara tradition",
    description:
      "Stone carved by hand in and around Taxila, where the Gandhara school flourished — reliefs, stupas, bookends and architectural fragments in schist and marble.",
    art: "stone",
    seed: 41,
  },
  {
    slug: "wall-decor",
    name: "Wall Décor & Accessories",
    tagline: "Blue pottery, carved wood and block print",
    description:
      "Multani blue pottery, Chiniot carved woodwork and Sindhi block print — heritage pieces for the walls and shelves of a home.",
    art: "pottery",
    seed: 51,
  },
  {
    slug: "posters-prints",
    name: "Posters & Prints",
    tagline: "Archival prints from Pakistani artists",
    description: "Limited-run archival prints of architecture, calligraphy and truck-art designs, signed and numbered.",
    art: "print",
    seed: 61,
  },
  {
    slug: "salt-art",
    name: "Salt Art & Décor",
    tagline: "Hand-shaped Himalayan salt from Khewra",
    description:
      "Lamps, candle holders and sculpted pieces cut from the pink salt of the Khewra mine in the Salt Range, each shaped and finished by hand.",
    art: "salt",
    seed: 71,
  },
  {
    slug: "bespoke",
    name: "Customize & Bespoke",
    tagline: "Commission a piece made for you",
    description:
      "Ask an artisan for something that doesn't exist yet — your family name in Nastaliq, a rug in your room's exact size, a carving for a gift.",
    art: "wood",
    seed: 81,
  },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const FAQS: { group: string; question: string; answer: string }[] = [
  {
    group: "Buying from Pakistan",
    question: "Who pays for shipping and import duty?",
    answer:
      "You do, and you see it before you pay. Every product page and your cart show the item price, international shipping, estimated import duty and tax for your country, and any Wahbayaan handling fee as separate lines. Where a rate has not been confirmed yet the line says so instead of showing zero, and we confirm it with you before your card is charged.",
  },
  {
    group: "Buying from Pakistan",
    question: "What currency will I be charged in?",
    answer:
      "Prices are shown and charged in your currency — US dollars, pounds sterling or Canadian dollars. You can switch the display to Pakistani rupees from the currency menu if you prefer; that is the only way PKR is shown to buyers.",
  },
  {
    group: "Buying from Pakistan",
    question: "Why might my order say “awaiting quote”?",
    answer:
      "For some destinations, weights or crafts we can't yet price shipping and duty automatically. Instead of guessing, our team prepares an exact quote. You approve it before anything is charged.",
  },
  {
    group: "Trust & protection",
    question: "How do I know an artisan is real?",
    answer:
      "Artisans with the Verified badge have passed identity, workshop and sample checks by our team. Their profile shows where they work, how long they have practised and their record on Wahbayaan.",
  },
  {
    group: "Trust & protection",
    question: "What happens to my payment?",
    answer:
      "Your payment is held by Wahbayaan, not sent to the artisan straight away. It is released to the artisan after you confirm delivery or after the protection window ends — whichever comes first — so you are covered if a piece arrives damaged or not as described.",
  },
  {
    group: "Trust & protection",
    question: "What if my piece arrives damaged?",
    answer:
      "Open a case from your order page with photos of the item and packaging. Held funds are frozen while we review it with you and the artisan, and we resolve it with a replacement, repair or refund.",
  },
  {
    group: "Delivery",
    question: "How long will delivery take?",
    answer:
      "Two things add up: the artisan's time to make or dispatch the piece (shown on every listing) and the courier's transit time to your country. Ready-to-ship pieces leave sooner; made-to-order pieces show their making time.",
  },
  {
    group: "Delivery",
    question: "Can I send a piece as a gift?",
    answer: "Yes. At checkout, mark the order as a gift, add a message, choose gift wrap and ship straight to the recipient.",
  },
  {
    group: "Artisans",
    question: "I'm an artisan in Pakistan. How do I sell on Wahbayaan?",
    answer:
      "Apply from the Become a Seller page with photos of your work. Our team verifies your identity and workshop, helps you list your pieces and handles international payment, customs paperwork and courier booking. You are paid in rupees.",
  },
];

export const POLICY_PAGES = [
  {
    slug: "buyer-protection",
    title: "Buyer protection",
    body: `Every Wahbayaan order is covered from the moment you pay until the piece is in your hands.

## How it works
1. **Your payment is held.** Funds stay with Wahbayaan while the artisan makes and ships your piece.
2. **You confirm delivery.** When the parcel arrives, confirm from your order page — or funds are released automatically when the protection window ends.
3. **Something wrong?** Open a case from your order with photos. We freeze the held funds and resolve it with you and the artisan.

## What's covered
- Damaged in transit
- Not as described (materials, size or finish differ from the listing)
- Never arrived

## Windows and timelines
> Pending business decision: the protection window after delivery and the return shipping policy are set in Admin → Settings → Buyer protection and will be published here once confirmed.
`,
  },
  {
    slug: "terms",
    title: "Terms of service",
    body: `> Draft — pending legal review. These terms must be reviewed by counsel before launch.

## Marketplace
Wahbayaan connects buyers with independent Pakistani artisans. Each artisan is responsible for the accuracy of their listings; Wahbayaan verifies artisans, holds buyer payments and coordinates international shipping.

## Pricing and duties
Buyers pay the item price, international shipping, import duties and taxes of their country, and any Wahbayaan handling fee. Estimates are shown before checkout and confirmed before payment where a rate is not yet known.
`,
  },
  {
    slug: "privacy",
    title: "Privacy policy",
    body: `> Draft — pending legal review.

We collect only what we need to fulfil and ship your order (name, address, email, phone for the courier) and to run the marketplace. Payment details are handled by our payment provider and never stored by Wahbayaan.
`,
  },
];

// ── Demo ────────────────────────────────────────────────────────────────────

export type DemoVendor = {
  slug: string;
  displayName: string;
  craft: string;
  category: CategorySlug;
  tagline: string;
  story: string;
  craftHistory: string;
  city: string;
  region: "punjab" | "sindh" | "khyber_pakhtunkhwa" | "balochistan" | "gilgit_baltistan" | "azad_kashmir" | "islamabad";
  foundedYear: number;
  languages: string[];
  responseTimeHours: number;
  art: string;
  featured?: boolean;
};

export const DEMO_VENDORS: DemoVendor[] = [
  {
    slug: "noor-calligraphy-atelier",
    displayName: "Noor Calligraphy Atelier",
    craft: "Nastaliq calligraphy",
    category: "calligraphy-art",
    tagline: "Verses in gold, written slowly",
    story:
      "A small atelier near the old walled city of Lahore where three calligraphers prepare their own reed pens, burnish their own paper and lay gold leaf by hand. Most pieces begin with a single line of poetry chosen with the buyer.",
    craftHistory:
      "The studio's founder trained for twelve years under a master of the Lahore Nastaliq school before opening the atelier. Every panel is written freehand; nothing is printed or traced.",
    city: "Lahore",
    region: "punjab",
    foundedYear: 2009,
    languages: ["Urdu", "English", "Punjabi"],
    responseTimeHours: 6,
    art: "calligraphy",
    featured: true,
  },
  {
    slug: "qila-rug-workshop",
    displayName: "Qila Rug Workshop",
    craft: "Hand-knotted rugs",
    category: "rugs",
    tagline: "Bukhara guls on vertical looms",
    story:
      "Four weaving families share the looms at Qila, on the edge of Peshawar. A 6×9 rug takes two weavers most of a season; the wool is hand-spun and washed in the courtyard before it is sheared flat.",
    craftHistory:
      "The workshop keeps a library of cartoons (knot-by-knot drawings) handed down between families, and still dyes a share of its wool with madder and indigo.",
    city: "Peshawar",
    region: "khyber_pakhtunkhwa",
    foundedYear: 1998,
    languages: ["Pashto", "Urdu", "English"],
    responseTimeHours: 12,
    art: "rug",
    featured: true,
  },
  {
    slug: "taxila-stone-guild",
    displayName: "Taxila Stone Guild",
    craft: "Stone carving",
    category: "sculpture-stone",
    tagline: "Gandhara forms, carved by hand",
    story:
      "Carvers in Taxila work the grey-green schist the Gandhara sculptors used, a few kilometres from the ruins that inspire them. Each relief is roughed out with a point chisel and finished with files and river sand.",
    craftHistory:
      "The guild was formed by carvers who had worked on restoration for local collections. They sign and date every piece and never sell work as antique.",
    city: "Taxila",
    region: "punjab",
    foundedYear: 2004,
    languages: ["Urdu", "Punjabi", "English"],
    responseTimeHours: 24,
    art: "stone",
    featured: true,
  },
  {
    slug: "khewra-salt-studio",
    displayName: "Khewra Salt Studio",
    craft: "Himalayan salt",
    category: "salt-art",
    tagline: "Pink salt, shaped by hand",
    story:
      "A family studio in the Salt Range that selects blocks from the Khewra mine and shapes them by hand into lamps and sculpted pieces, each mounted on local sheesham wood.",
    craftHistory:
      "The studio started as a stall at the mine's visitor entrance and now finishes every piece in its own workshop, testing each lamp's wiring before it is packed.",
    city: "Khewra",
    region: "punjab",
    foundedYear: 2015,
    languages: ["Urdu", "Punjabi"],
    responseTimeHours: 8,
    art: "salt",
  },
  {
    slug: "multan-blue-kiln",
    displayName: "Multan Blue Kiln",
    craft: "Multani blue pottery",
    category: "wall-decor",
    tagline: "Cobalt and turquoise on white",
    story:
      "A kiln workshop in Multan painting the cobalt-and-turquoise florals the city's shrines are known for. Pieces are thrown, dried in the sun, painted freehand and fired in a wood kiln.",
    craftHistory:
      "Three generations of the family have worked the same kiln. Today they also restore tile panels and teach apprentices from the neighbourhood.",
    city: "Multan",
    region: "punjab",
    foundedYear: 1987,
    languages: ["Saraiki", "Urdu"],
    responseTimeHours: 18,
    art: "pottery",
  },
  {
    slug: "rangeen-sarak-studio",
    displayName: "Rangeen Sarak Studio",
    craft: "Truck-art painting",
    category: "paintings",
    tagline: "Karachi's roads, on canvas",
    story:
      "Painters who learned their trade decorating trucks and buses in Karachi now bring the same enamel florals, mirror-work borders and hand lettering to canvas, wood and tin panels.",
    craftHistory:
      "The studio's lead painter spent fifteen years in the truck yards before opening the studio; the team still paints two trucks a year to keep their hand in.",
    city: "Karachi",
    region: "sindh",
    foundedYear: 2012,
    languages: ["Urdu", "Sindhi", "English"],
    responseTimeHours: 4,
    art: "truckart",
  },
  {
    slug: "hala-block-house",
    displayName: "Hala Block House",
    craft: "Ajrak & kashi",
    category: "wall-decor",
    tagline: "Block print and glazed tile from Hala",
    story:
      "In Hala, a town long known for its crafts, this workshop carves its own wooden blocks and prints ajrak cloth in the classic crimson and indigo, alongside glazed kashi tiles fired in the same yard.",
    craftHistory:
      "The family has printed ajrak for generations; they still use a resist-and-dye sequence that takes about two weeks per length of cloth.",
    city: "Hala",
    region: "sindh",
    foundedYear: 2001,
    languages: ["Sindhi", "Urdu"],
    responseTimeHours: 20,
    art: "ajrak",
  },
  {
    slug: "chiniot-jharokha-works",
    displayName: "Chiniot Jharokha Works",
    craft: "Carved woodwork",
    category: "bespoke",
    tagline: "Chiniot carving in sheesham and walnut",
    story:
      "Woodcarvers in Chiniot, a city famous across Pakistan for its furniture, making jharokha panels, jali screens and mirror frames in seasoned sheesham and walnut — most to the buyer's own measurements.",
    craftHistory:
      "The workshop's master carver learned from his uncle, who carved doors for havelis in the city. Custom sizes are the norm rather than the exception.",
    city: "Chiniot",
    region: "punjab",
    foundedYear: 1994,
    languages: ["Punjabi", "Urdu"],
    responseTimeHours: 16,
    art: "wood",
  },
];

export type DemoProduct = {
  vendor: string;
  category: CategorySlug;
  title: string;
  summary: string;
  description: string;
  story?: string;
  pricePkr: number; // whole rupees
  compareAtPricePkr?: number;
  availability: "ready_to_ship" | "made_to_order";
  timeToMakeDays?: number;
  dispatchDays?: number;
  stockQty?: number;
  oneOfAKind?: boolean;
  dims: [number, number, number]; // w × h × d cm
  weightG: number | null;
  materials: string[];
  techniques?: string[];
  care?: string;
  art: string;
  seeds: number[];
  featured?: boolean;
  limitedDrop?: { startsInDays: number; editionSize?: number };
  customization?: { id: string; label: string; kind: "text" | "select"; choices?: string[]; required?: boolean; maxLength?: number; extraPricePkr?: number }[];
  wholesale?: { minQty: number; pricePkr: number };
};

export const DEMO_PRODUCTS: DemoProduct[] = [
  // Noor Calligraphy Atelier
  {
    vendor: "noor-calligraphy-atelier",
    category: "calligraphy-art",
    title: "“Worlds beyond the stars” — Iqbal in gold Nastaliq",
    summary: "Allama Iqbal's line in gold leaf on indigo wasli, framed with ebru margins.",
    description:
      "The line “ستاروں سے آگے جہاں اور بھی ہیں” — there are worlds beyond the stars — written in a single sitting in Nastaliq on hand-burnished wasli paper, gilded with 23-carat gold leaf and set in hand-marbled ebru margins. Framed under museum glass in a gilded wooden moulding.",
    story: "One of the atelier's favourite lines to write: a reminder, Iqbal said, that every horizon is a beginning.",
    pricePkr: 186000,
    availability: "ready_to_ship",
    dispatchDays: 4,
    oneOfAKind: true,
    dims: [76, 51, 4],
    weightG: 4200,
    materials: ["wasli paper", "gold leaf", "ebru paper", "wood frame", "glass"],
    techniques: ["Nastaliq", "gilding", "ebru marbling"],
    care: "Hang away from direct sunlight and humidity. Dust the glass with a dry cloth.",
    art: "calligraphy",
    seeds: [8, 16, 24],
    featured: true,
  },
  {
    vendor: "noor-calligraphy-atelier",
    category: "calligraphy-art",
    title: "Noor — single-word panel",
    summary: "The word for light, written large in gold on midnight indigo.",
    description:
      "A single word — نور, light — written large with a broad reed pen, gilded and framed. Single-word panels are how calligraphers practise proportion; this one is sized to hold a wall on its own.",
    pricePkr: 98000,
    availability: "ready_to_ship",
    dispatchDays: 3,
    oneOfAKind: true,
    dims: [50, 60, 3],
    weightG: 2600,
    materials: ["wasli paper", "gold leaf", "wood frame", "glass"],
    techniques: ["Nastaliq", "gilding"],
    art: "calligraphy",
    seeds: [2, 10],
  },
  {
    vendor: "noor-calligraphy-atelier",
    category: "calligraphy-art",
    title: "Your name in Nastaliq — commissioned panel",
    summary: "A name or short phrase of your choice, written and gilded for you.",
    description:
      "Tell us the name or phrase (Urdu, Arabic, Persian — or English, transliterated) and the calligrapher will send two sketches before writing the final panel. Gold or black ink; indigo, ivory or crimson ground.",
    pricePkr: 72000,
    availability: "made_to_order",
    timeToMakeDays: 21,
    dims: [40, 50, 3],
    weightG: 2100,
    materials: ["wasli paper", "gold leaf or ink", "wood frame", "glass"],
    techniques: ["Nastaliq"],
    art: "calligraphy",
    seeds: [7, 15],
    customization: [
      { id: "text", label: "Name or phrase to write", kind: "text", required: true, maxLength: 40 },
      { id: "ink", label: "Ink", kind: "select", choices: ["Gold leaf", "Black ink"], required: true },
      { id: "ground", label: "Ground colour", kind: "select", choices: ["Indigo", "Ivory", "Crimson"], required: true },
    ],
  },
  {
    vendor: "noor-calligraphy-atelier",
    category: "posters-prints",
    title: "Mohabbat — archival giclée print",
    summary: "Signed, numbered print of the atelier's ‘love’ panel.",
    description: "Printed on 310gsm cotton rag with archival pigment inks from a high-resolution scan of the original, signed and numbered in an edition of 100.",
    pricePkr: 14500,
    availability: "ready_to_ship",
    dispatchDays: 2,
    stockQty: 40,
    dims: [40, 50, 0.1],
    weightG: 450,
    materials: ["cotton rag paper", "pigment ink"],
    art: "calligraphy",
    seeds: [3, 19],
    wholesale: { minQty: 10, pricePkr: 9800 },
  },

  // Qila Rug Workshop
  {
    vendor: "qila-rug-workshop",
    category: "rugs",
    title: "Madder-red Bukhara, 6×9 ft",
    summary: "Hand-knotted wool with the classic elephant-foot gul.",
    description:
      "A 6×9 ft hand-knotted rug in hand-spun wool on a cotton foundation, with the elephant-foot guls of the Bukhara tradition on a madder-red field. Washed, sun-dried and hand-sheared in the workshop courtyard.",
    story: "Two weavers from one family knotted this rug over about four months.",
    pricePkr: 385000,
    availability: "ready_to_ship",
    dispatchDays: 5,
    oneOfAKind: true,
    dims: [183, 274, 1.2],
    weightG: 14500,
    materials: ["hand-spun wool", "cotton foundation", "natural dyes"],
    techniques: ["hand-knotted", "Persian knot"],
    care: "Rotate every six months. Vacuum without the beater bar; professional wash only.",
    art: "rug",
    seeds: [4, 12, 28],
    featured: true,
  },
  {
    vendor: "qila-rug-workshop",
    category: "rugs",
    title: "Indigo gul runner, 2.5×10 ft",
    summary: "A long hallway runner in indigo and ivory.",
    description: "A hand-knotted runner in indigo and ivory wool, sized for hallways and the long side of a bed.",
    pricePkr: 168000,
    availability: "ready_to_ship",
    dispatchDays: 5,
    oneOfAKind: true,
    dims: [76, 305, 1.2],
    weightG: 6200,
    materials: ["hand-spun wool", "cotton foundation"],
    techniques: ["hand-knotted"],
    art: "rug",
    seeds: [5, 13],
  },
  {
    vendor: "qila-rug-workshop",
    category: "rugs",
    title: "Made-to-size Bukhara — your dimensions",
    summary: "Choose size and colourway; woven for your room.",
    description:
      "Tell us your room's measurements and choose a colourway; the workshop draws the cartoon to fit and sends it for approval before the first knot. Typical making time is three to five months depending on size.",
    pricePkr: 290000,
    availability: "made_to_order",
    timeToMakeDays: 120,
    dims: [152, 244, 1.2],
    weightG: 10500,
    materials: ["hand-spun wool", "cotton foundation"],
    techniques: ["hand-knotted"],
    art: "rug",
    seeds: [9, 17],
    customization: [
      { id: "size", label: "Size", kind: "select", choices: ["5×8 ft", "6×9 ft", "8×10 ft", "9×12 ft", "Custom (tell us in notes)"], required: true },
      { id: "colourway", label: "Colourway", kind: "select", choices: ["Madder red", "Indigo", "Ivory", "Forest green", "Rust"], required: true },
      { id: "notes", label: "Notes for the weavers", kind: "text", maxLength: 300 },
    ],
  },
  {
    vendor: "qila-rug-workshop",
    category: "rugs",
    title: "Rust & ivory prayer-size rug, 3×5 ft",
    summary: "A small hand-knotted piece for an entry or bedside.",
    description: "A small-format hand-knotted rug in rust and ivory, ideal for an entryway or beside a bed.",
    pricePkr: 74000,
    availability: "ready_to_ship",
    dispatchDays: 4,
    oneOfAKind: true,
    dims: [91, 152, 1.2],
    weightG: 3100,
    materials: ["hand-spun wool", "cotton foundation"],
    techniques: ["hand-knotted"],
    art: "rug",
    seeds: [6, 22],
  },

  // Taxila Stone Guild
  {
    vendor: "taxila-stone-guild",
    category: "sculpture-stone",
    title: "Stupa niche relief in grey schist",
    summary: "A Gandhara-style niche with stupa and pilasters, carved by hand.",
    description:
      "A wall relief in grey-green schist showing a stupa inside an arched niche flanked by pilasters — a composition drawn from the Gandhara school. Carved by hand, signed and dated on the reverse; a contemporary piece, not an antiquity.",
    pricePkr: 214000,
    availability: "ready_to_ship",
    dispatchDays: 6,
    oneOfAKind: true,
    dims: [36, 52, 8],
    weightG: 18000,
    materials: ["schist"],
    techniques: ["hand carving"],
    care: "Indoors only. Dust with a soft brush.",
    art: "stone",
    seeds: [2, 14, 30],
    featured: true,
  },
  {
    vendor: "taxila-stone-guild",
    category: "sculpture-stone",
    title: "Schist bookends, pair",
    summary: "A heavy pair of carved bookends with a stupa motif.",
    description: "A pair of bookends carved from schist offcuts with a small stupa relief on each face. Felted bases.",
    pricePkr: 38000,
    availability: "ready_to_ship",
    dispatchDays: 4,
    stockQty: 6,
    dims: [14, 18, 10],
    weightG: 5200,
    materials: ["schist", "felt"],
    art: "stone",
    seeds: [7, 21],
  },
  {
    vendor: "taxila-stone-guild",
    category: "sculpture-stone",
    title: "Commissioned architectural panel",
    summary: "A large relief carved to your design and dimensions.",
    description: "Large-format relief panels for walls, gardens (sheltered) and fireplaces. The guild sends a drawing and a stone sample for approval first.",
    pricePkr: 420000,
    availability: "made_to_order",
    timeToMakeDays: 75,
    dims: [60, 90, 10],
    weightG: 52000,
    materials: ["schist or marble"],
    art: "stone",
    seeds: [11, 25],
    customization: [
      { id: "stone", label: "Stone", kind: "select", choices: ["Grey schist", "White marble"], required: true },
      { id: "design", label: "Describe the design", kind: "text", required: true, maxLength: 400 },
    ],
  },

  // Khewra Salt Studio
  {
    vendor: "khewra-salt-studio",
    category: "salt-art",
    title: "Hand-shaped salt lamp on sheesham base, large",
    summary: "A natural-form pink salt lamp, 6–8 kg.",
    description:
      "Cut from a single block of Khewra pink salt and shaped by hand, mounted on a turned sheesham base. Supplied with a plug for your country and a spare bulb.",
    pricePkr: 16500,
    availability: "ready_to_ship",
    dispatchDays: 2,
    stockQty: 24,
    dims: [20, 30, 20],
    weightG: 7500,
    materials: ["Himalayan salt", "sheesham wood"],
    care: "Keep dry; salt attracts moisture. Wipe with a dry cloth.",
    art: "salt",
    seeds: [3, 11, 19],
    wholesale: { minQty: 12, pricePkr: 11200 },
  },
  {
    vendor: "khewra-salt-studio",
    category: "salt-art",
    title: "Salt tealight holders, set of four",
    summary: "Four hand-cut blocks for tealights.",
    description: "Four hand-cut salt blocks, each hollowed for a tealight. A warm glow for a mantelpiece or dinner table.",
    pricePkr: 7800,
    availability: "ready_to_ship",
    dispatchDays: 2,
    stockQty: 30,
    dims: [8, 8, 8],
    weightG: 2400,
    materials: ["Himalayan salt"],
    art: "salt",
    seeds: [5, 23],
  },
  {
    vendor: "khewra-salt-studio",
    category: "salt-art",
    title: "Carved salt sculpture — minaret",
    summary: "A sculpted salt minaret with internal light.",
    description: "A sculpted minaret carved from one block of salt with a concealed light inside. A limited run the studio makes a few times a year.",
    pricePkr: 34000,
    availability: "ready_to_ship",
    dispatchDays: 3,
    stockQty: 5,
    dims: [16, 42, 16],
    weightG: 9000,
    materials: ["Himalayan salt", "sheesham wood"],
    art: "salt",
    seeds: [8, 27],
    limitedDrop: { startsInDays: 6, editionSize: 12 },
  },

  // Multan Blue Kiln
  {
    vendor: "multan-blue-kiln",
    category: "wall-decor",
    title: "Multani blue charger plate, 45 cm",
    summary: "A large wall charger with a rosette centre and a ring of florals.",
    description: "A large charger thrown, painted and fired in the family's wood kiln, with a painted rosette centre and a ring of florals. Supplied with a hanging wire.",
    pricePkr: 42000,
    availability: "ready_to_ship",
    dispatchDays: 4,
    oneOfAKind: true,
    dims: [45, 45, 5],
    weightG: 3400,
    materials: ["earthenware", "cobalt glaze"],
    techniques: ["wheel-thrown", "hand-painted"],
    care: "Decorative. Hand wash only.",
    art: "pottery",
    seeds: [1, 4, 7],
    featured: true,
  },
  {
    vendor: "multan-blue-kiln",
    category: "wall-decor",
    title: "Blue pottery bowl",
    summary: "A deep serving bowl in cobalt and turquoise.",
    description: "A deep bowl painted with a band of florals, glazed inside and out.",
    pricePkr: 12500,
    availability: "ready_to_ship",
    dispatchDays: 3,
    stockQty: 12,
    dims: [28, 12, 28],
    weightG: 1300,
    materials: ["earthenware", "cobalt glaze"],
    art: "pottery",
    seeds: [2, 5],
    wholesale: { minQty: 12, pricePkr: 8400 },
  },
  {
    vendor: "multan-blue-kiln",
    category: "wall-decor",
    title: "Tall floral vase",
    summary: "A 40 cm vase in the Multani floral style.",
    description: "A tall vase with a narrow neck and banded florals, painted freehand.",
    pricePkr: 26500,
    availability: "ready_to_ship",
    dispatchDays: 3,
    stockQty: 4,
    dims: [20, 40, 20],
    weightG: 2200,
    materials: ["earthenware", "cobalt glaze"],
    art: "pottery",
    seeds: [3, 6],
  },

  // Rangeen Sarak Studio
  {
    vendor: "rangeen-sarak-studio",
    category: "paintings",
    title: "Phool — truck-art panel on wood",
    summary: "Enamel florals, mirror dots and a scalloped jhalar border.",
    description:
      "Painted in enamel on a seasoned wood panel with the studio's signature blossom, a scalloped jhalar border and hand-set mirror dots. Varnished and ready to hang.",
    pricePkr: 64000,
    availability: "ready_to_ship",
    dispatchDays: 3,
    oneOfAKind: true,
    dims: [61, 76, 3],
    weightG: 3800,
    materials: ["enamel paint", "wood panel", "mirror"],
    techniques: ["truck art"],
    art: "truckart",
    seeds: [1, 9, 17],
    featured: true,
  },
  {
    vendor: "rangeen-sarak-studio",
    category: "paintings",
    title: "Midnight bloom — large canvas",
    summary: "A large truck-art canvas on a deep crimson ground.",
    description: "A large-format canvas in the truck-art style with layered blossoms on a deep crimson ground.",
    pricePkr: 128000,
    availability: "ready_to_ship",
    dispatchDays: 4,
    oneOfAKind: true,
    dims: [90, 120, 4],
    weightG: 5400,
    materials: ["enamel paint", "canvas", "wood stretcher"],
    techniques: ["truck art"],
    art: "truckart",
    seeds: [2, 12],
  },
  {
    vendor: "rangeen-sarak-studio",
    category: "bespoke",
    title: "Custom truck-art name board",
    summary: "Your name or message, lettered and painted truck-art style.",
    description: "A hand-lettered board with the message of your choice in Urdu or English, framed by truck-art florals.",
    pricePkr: 38000,
    availability: "made_to_order",
    timeToMakeDays: 14,
    dims: [60, 30, 2],
    weightG: 1800,
    materials: ["enamel paint", "wood panel"],
    art: "truckart",
    seeds: [3, 13],
    customization: [
      { id: "text", label: "Message", kind: "text", required: true, maxLength: 30 },
      { id: "script", label: "Script", kind: "select", choices: ["Urdu", "English"], required: true },
    ],
  },
  {
    vendor: "rangeen-sarak-studio",
    category: "posters-prints",
    title: "Badshahi skyline — screen print",
    summary: "A two-colour architectural screen print, signed.",
    description: "A hand-pulled screen print of a Mughal skyline at dusk, signed and numbered.",
    pricePkr: 9800,
    availability: "ready_to_ship",
    dispatchDays: 2,
    stockQty: 60,
    dims: [42, 59, 0.1],
    weightG: 350,
    materials: ["cotton paper", "screen-print ink"],
    art: "print",
    seeds: [1, 2],
    wholesale: { minQty: 20, pricePkr: 6200 },
  },
  {
    vendor: "rangeen-sarak-studio",
    category: "posters-prints",
    title: "Lakeside mosque — archival print",
    summary: "An archival print in teal and green.",
    description: "Archival pigment print of an original gouache study, signed.",
    pricePkr: 11200,
    availability: "ready_to_ship",
    dispatchDays: 2,
    stockQty: 45,
    dims: [42, 59, 0.1],
    weightG: 350,
    materials: ["cotton rag paper", "pigment ink"],
    art: "print",
    seeds: [3, 4],
  },

  // Hala Block House
  {
    vendor: "hala-block-house",
    category: "wall-decor",
    title: "Classic ajrak — hand block-printed cloth",
    summary: "Crimson and indigo ajrak, resist-dyed over two weeks.",
    description:
      "A full-length ajrak cloth printed with hand-carved blocks and resist-dyed in crimson and indigo. Wear it as a shawl, drape it over a sofa or frame it.",
    pricePkr: 14000,
    availability: "ready_to_ship",
    dispatchDays: 3,
    stockQty: 20,
    dims: [110, 250, 0.2],
    weightG: 450,
    materials: ["cotton", "natural dyes"],
    techniques: ["block print", "resist dyeing"],
    care: "Hand wash cold, separately. Dry in shade.",
    art: "ajrak",
    seeds: [1, 5, 9],
    wholesale: { minQty: 15, pricePkr: 9500 },
  },
  {
    vendor: "hala-block-house",
    category: "wall-decor",
    title: "Kashi tile panel, 4 tiles",
    summary: "Four glazed tiles forming a single floral medallion.",
    description: "Four hand-painted glazed tiles that join into one floral medallion, mounted on a board for hanging.",
    pricePkr: 28000,
    availability: "ready_to_ship",
    dispatchDays: 4,
    stockQty: 8,
    dims: [40, 40, 3],
    weightG: 4100,
    materials: ["glazed ceramic tile", "wood board"],
    art: "tile",
    seeds: [2, 6],
  },
  {
    vendor: "hala-block-house",
    category: "wall-decor",
    title: "Ajrak cushion covers, pair",
    summary: "Two block-printed cushion covers, 45 cm.",
    description: "A pair of cushion covers cut from block-printed ajrak with hidden zips.",
    pricePkr: 8600,
    availability: "ready_to_ship",
    dispatchDays: 3,
    stockQty: 25,
    dims: [45, 45, 1],
    weightG: 380,
    materials: ["cotton", "natural dyes"],
    art: "ajrak",
    seeds: [3, 7],
  },

  // Chiniot Jharokha Works
  {
    vendor: "chiniot-jharokha-works",
    category: "wall-decor",
    title: "Carved jharokha panel in sheesham",
    summary: "An arched panel with a floral jali and a carved rosette.",
    description:
      "An arched wall panel in seasoned sheesham with a pierced floral jali beneath a carved rosette. Oiled and waxed; supplied with a French cleat for hanging.",
    pricePkr: 158000,
    availability: "ready_to_ship",
    dispatchDays: 6,
    oneOfAKind: true,
    dims: [60, 100, 5],
    weightG: 12500,
    materials: ["sheesham wood", "natural oil"],
    techniques: ["hand carving", "jali piercing"],
    care: "Dust regularly; re-wax once a year.",
    art: "wood",
    seeds: [1, 4, 8],
    featured: true,
  },
  {
    vendor: "chiniot-jharokha-works",
    category: "bespoke",
    title: "Made-to-measure jali screen",
    summary: "A room divider or window screen carved to your size.",
    description: "Screens and window jalis carved to your exact measurements. The workshop sends a drawing for approval first.",
    pricePkr: 240000,
    availability: "made_to_order",
    timeToMakeDays: 60,
    dims: [90, 180, 4],
    weightG: null,
    materials: ["sheesham or walnut"],
    art: "wood",
    seeds: [2, 6],
    customization: [
      { id: "wood", label: "Wood", kind: "select", choices: ["Sheesham", "Walnut"], required: true },
      { id: "size", label: "Width × height (cm)", kind: "text", required: true, maxLength: 40 },
    ],
  },
];

export const DEMO_JOURNAL = [
  {
    slug: "multani-blue-pottery",
    title: "The blue of Multan",
    category: "wall-decor",
    art: "pottery",
    seed: 44,
    excerpt: "How a southern Punjab city came to be known for cobalt and turquoise on white.",
    body: `Multan is one of the oldest continuously inhabited cities in South Asia, and for centuries its shrines have been clad in glazed tile — cobalt, turquoise and white. The same palette carries into the city's pottery: plates, vases and bowls painted with florals and stars.

## From tile to table
The skills that decorate a shrine's façade — preparing the white slip, grinding the blue, painting freehand — are the same ones used on a charger plate. Many workshops do both, restoring tile panels in one season and throwing pots the next.

## How a piece is made
1. **Thrown or moulded** from local clay and dried in the sun.
2. **Coated in white slip**, which gives the bright ground.
3. **Painted freehand** with cobalt and turquoise; no stencils.
4. **Glazed and fired**, traditionally in a wood-fired kiln.

## Caring for blue pottery
Most pieces are decorative. Hand-wash, avoid sudden temperature changes, and hang heavy chargers on a wire rated for their weight.`,
  },
  {
    slug: "how-a-hand-knotted-rug-is-made",
    title: "Knot by knot: how a hand-knotted rug is made",
    category: "rugs",
    art: "rug",
    seed: 45,
    excerpt: "From spinning the wool to the final shear — why a 6×9 rug takes a season.",
    body: `A hand-knotted rug is built one knot at a time on a vertical loom. Every knot is tied around two warp threads, cut, and beaten down with a comb; rows of knots are locked with weft threads between them.

## The cartoon
Weavers follow a *cartoon* — a drawing on graph paper where each square is one knot. Workshops keep their cartoons for decades.

## Wool and dye
Hand-spun wool gives the slight irregularity that makes a hand-knotted rug glow. Some workshops still dye part of their wool with madder root (reds) and indigo (blues).

## Finishing
When the last row is tied, the rug is cut from the loom, washed, dried flat in the sun and sheared so the pattern reads crisply. The fringe is the warp itself — not something sewn on.

## Why it takes so long
Two weavers working side by side might tie several thousand knots a day. A 6×9 rug can hold well over a million, so a season on the loom is normal.`,
  },
  {
    slug: "nastaliq-the-hanging-script",
    title: "Nastaliq, the hanging script",
    category: "calligraphy-art",
    art: "calligraphy",
    seed: 46,
    excerpt: "Why Urdu calligraphy slopes, and what makes a line of Nastaliq beautiful.",
    body: `Nastaliq developed in Persia in the fourteenth and fifteenth centuries and became the script of choice for Persian poetry — and later for Urdu. Its words slope from upper right to lower left, which is why it is sometimes called the *hanging* script.

## Proportion
Calligraphers measure letters in dots made by the pen's nib. Learning Nastaliq means learning these proportions by copying a master's exemplars, often for years.

## Tools
A reed pen (*qalam*) cut at an angle, carbon ink, and *wasli* — layers of paper glued together and burnished smooth so the pen glides. Gold leaf is laid on a size and burnished once dry.

## Reading a panel
Look at the rhythm of the baseline, the spacing between words and the balance of dots and diacritics. A single word — like نور, *light* — can be a lifetime's study.`,
  },
  {
    slug: "taxila-and-gandhara",
    title: "Taxila and the Gandhara tradition",
    category: "sculpture-stone",
    art: "stone",
    seed: 47,
    excerpt: "Carving today in the shadow of one of the region's great ancient cities.",
    body: `Taxila, northwest of Islamabad, was a major city of the ancient Gandhara region and is today a UNESCO World Heritage Site. Gandhara art — especially its grey schist sculpture — blended local traditions with influences from the Hellenistic world.

## A living craft
Carvers around Taxila still work in the same stone. Their reliefs often draw on Gandhara compositions: stupas, arched niches and columns with acanthus capitals.

## Contemporary, not antique
Every piece sold on Wahbayaan is a signed, contemporary work. We do not list antiquities, and each certificate of authenticity records the carver and the date the piece was made.`,
  },
];
