# Engineering conventions

Read this before adding pages. It is short on purpose.

## Next.js 16 (not the version you remember)

- `params`, `searchParams`, `cookies()` and `headers()` are **async**. Type pages with the global helpers: `export default async function Page(props: PageProps<"/product/[slug]">) { const { slug } = await props.params; }`. Route handlers: `RouteContext<"/media/[...path]">`. Run `npx next typegen` after adding routes if types are missing.
- `middleware.ts` is now `src/proxy.ts`.
- After a mutation in a server action call `refresh()` (from `next/cache`) to re-render the current page, or `redirect()`.
- The root layout sets `dynamic = "force-dynamic"`: every page renders per request.
- Bundled docs live in `node_modules/next/dist/docs/`.

## Data

- `const d = await db()` from `@/lib/db/client` (server only). Schema: `@/lib/db/schema`. Drizzle query builder or `d.query.<table>.findMany({ with })`.
- Money is integer **minor units**. Seller-side columns end in `Pkr`. Buyer-side order amounts are in `orders.currency`.
- Never write to the DB from scripts while `next dev` is running (single-process embedded Postgres).
- Schema changes: edit `schema.ts`, run `npm run db:generate`, commit the migration.
- Scheduled jobs (`/api/cron/<job>`: auto-release, fx-refresh, brands, analytics-cleanup): Vercel runs them from `vercel.json`; everywhere else (Railway) `src/instrumentation-node.ts` calls them from inside the server every 10 minutes with `?everyHours=`, and the route skips a job that ran too recently (`cron_last_run` setting), so deploys don't repeat daily jobs. Production only; `WB_JOBS=off` disables it, `WB_JOBS=auto-release,brands` limits it. Logs show `[jobs] …`.

## Currency surfaces (brief constraint)

- Storefront (`src/app/(store)`, `src/app/(home)`, `src/components/store`): render prices with `<BuyerPrice pkr={…} />` or format landed-cost amounts with `formatMoney(amount, landed.currency)`. Never import `SellerPrice`.
- Seller dashboard (`src/app/seller`, `src/components/seller`): `<SellerPrice pkr={…} />` only. Never import `BuyerPrice` or `getBuyerContext`.
- Admin: PKR by default via `SellerPrice`; buyer-order totals are shown with `formatMoney(amount, order.currency)` and labelled with the currency.
- `tests/currency-surfaces.test.ts` fails the build if these are mixed.
- **Buyers in Pakistan.** `BUYER_DESTINATIONS` = the import destinations (`DESTINATIONS`: US/GB/CA — duty, import rules and courier tables iterate these) **plus `PK`**. A buyer whose destination is `PK` defaults to PKR through the same buyer context; overseas buyers keep USD/GBP/CAD. The currency follows the buyer, not the parcel: an overseas buyer sending a gift to Pakistan still pays in their currency. Storefront pages never hard-code a currency — they use `BuyerPrice` / `formatMoney(amount, landed.currency)` exactly as before.
- Destination `PK` is domestic in the landed-cost engine: "Delivery within Pakistan", import duty not applicable, shipping still pending until a real rate exists.

## Honesty rules

- Rates without real data (shipping, duty, tax, handling, commission, gift wrap) are `pending`. Show "Pending" / "Pending real rate data", never `0` and never an invented number.
- Demo rows have `isDemo = true`. Anything shown to buyers goes through the guards in `src/lib/queries/catalog.ts` (which use `src/lib/trust/visibility.ts`). Do not query `products`/`vendors`/`categories` directly for public listings.
- Artwork from `/art/...` is an illustration standing in for photography. Customers never see QA labels ("Illustration", "Demo content", "Sample review", demo logins): they render only when the build sets `NEXT_PUBLIC_WB_QA_LABELS=1` (`SHOW_QA_LABELS` in `src/lib/qa.ts`). The admin launch-readiness check lists every illustration that still needs a real photo before launch.
- Shipments over `FREIGHT_THRESHOLD_G` (70 kg — furniture, snooker tables) are freight: shipping stays `pending` with a freight explanation until logistics quotes it.

## Pakistani Brands (`/brands`)

- Separate catalogue: `brands`, `brand_sources`, `brand_sync_runs`, `brand_products` (+ variants with size/colour/stock, images), a separate brand bag, and `orders.kind = "brand"` with `brand_order_items` and a per-brand `brand_fulfilments` checklist. Never put brand items in `products`.
- **Permission gate.** Automatic import (Sync now, `/api/cron/brands`, feed upload) runs only after an admin recorded the brand's permission (who, when, note — audited); the engine (`src/lib/brands/sync.ts`) checks it itself. A brand's catalogue, logo and photos are public only when `partnership = "authorised"` *and* the permission is recorded (`catalogueDisplayGate`, used by `brandIssues`). Other brands are reachable only through the wording-neutral "Shop by link" flow (`/brands/request`), which never fetches the link and shows only its domain.
- Public brand queries go through `src/lib/queries/brands.ts` (guards in `src/lib/trust/visibility.ts`).
- The Wahbayaan service fee (`brand_margin` setting, `src/lib/brands/margin.ts`) is always its own line — never folded into the item price. Pending outside the configured bands.
- Brand quotes reuse the landed-cost engine via `computeBrandQuote` (`src/lib/brands/pricing.ts`).
- Couriers: `couriers` table; rate cards are `shipping_rates` rows linked by `courierId` (domestic rows: destination `PK` + city `zone`). Inactive couriers' rates are never offered.
- Payment methods (`src/lib/payments/methods.ts`): card / JazzCash / Easypaisa per market. Only non-secret config in settings; secrets are env vars. No cash on delivery.
- Recorded adapter fixtures (FICTIONAL brands) live in `tests/fixtures/brands/`; `fixture:<name>` source URLs work outside production only.

## Cookie consent & visitor statistics

- The banner (`src/components/consent`) is mounted by the storefront layouts via `<ConsentRoot />`. Bots get no markup; `/privacy` never auto-opens it; any link to `#cookie-settings` reopens the settings.
- Third-party scripts or embeds load only after consent: `window.Consent.whenAllowed("functional", fn)` or `useConsent()`; videos use `<ConsentEmbed url=… />` (no third-party request before consent).
- Add a new third-party service to `SERVICES` in `src/lib/consent/services.ts` (the banner, footnotes and privacy cookie list follow), then raise the consent version in Admin → Privacy & tracking.
- Statistics are stored only by `/api/collect`, which re-checks the consent cookie (Statistics + current version). Look: `consent_banner` setting → `--consent-*` CSS variables. Tables: `analytics_visits`, `analytics_page_views`, `consent_records`, `ip_geo_cache`.

## Fulfilment (`src/lib/fulfilment`)

- One cart, one payment, one order; behind the scenes one parcel per seller. `ensureFulfilment` (called from `markPaid`) routes the order: **domestic** (`PK`) → `direct` (each seller books a courier and ships to the buyer; one `shipments` row per artisan sub-order); **international** → `hub` when an origin hub is active and consolidation is on (Admin → Hubs & booking), else `direct`. Brand orders use the hub whenever one is active. Orders without an `order_fulfilments` row are older direct orders.
- Tables: `hubs` (origin / city / forwarder; `[Add: …]` address placeholders until the owner picks a site), `order_fulfilments`, `hub_parcels` (seller → hub, statuses expected → in_transit → received → qc_passed/qc_failed → shipped), `shipments` (+ `shipment_items`; `direct`, `consolidated`, `partial`), `fulfilment_quotes` (extra shipping after payment), `return_requests`.
- Escrow and payouts are untouched: everything still moves artisan sub-orders through `vendorOrderAction`. Hub boxes call it with `{ quiet: true }` so the buyer gets one event + one email per box, not per parcel.
- Pure rules live in `consolidation.ts` (x of y arrived, slowest item + hub handling days, lateness, partial-shipment check, volumetric / chargeable weight), `domestic-parcels.ts` (one zoned rate per seller; same city → `same_city` zone; any parcel unpriced → the whole line is pending), `reference.ts` (`WB-XXXXXX-P1K` parcel / `-S1M` box references with a check character), `barcode.ts` (Code 128 SVG), `label.ts`, `journey.ts`, `plan.ts`.
- **Never charge more silently.** A second box (partial shipment) or a heavier packed box is a `fulfilment_quotes` row the buyer approves and pays; declining charges nothing. "Ship ready items now" is only allowed when a seller is late past the threshold.
- Couriers are booked through adapters (`couriers/`): `manual` (type the tracking number; link from the courier's URL template) and `sandbox` (demo/tests, `SBX…` numbers, refused in production). Real providers are listed in `couriers/providers.ts` with the env var names they will read — no courier API is called until an integration is written against the courier's own documentation. The adapter per courier is chosen in Admin → Hubs & booking.
- Printable labels: `/labels/<reference>` (staff, or the seller who owns the parcel). Consolidated commercial invoice + packing list: `/admin/orders/<n>/invoice?shipment=<reference>`.
- Returns: requested from the order page inside `buyer_protection.returnWindowDays` (while that is pending: until funds are released). Opening one pauses escrow auto-release; refunds go through `refundOrder`.
- Permissions: `hub.operate` (hub screens), `hubs.manage` (hub configuration, booking adapters).
- E2E: `scripts/e2e-fulfilment.mjs` switches the fictional "Demo Hub (Lahore)" on for its run and off again afterwards.

## Auth

- Buyer pages: `await requireUser("/account/...")`.
- Seller pages: `await requireSeller()` (layout already does it; actions must re-check and scope every query by `user.vendorId`).
- Admin pages: `await requireStaff("orders.view")` (visitor statistics: `analytics.view` / `analytics.manage`); admin server actions: `const user = await assertStaff("orders.manage")` then `await audit({...})`.

## UI kit

- `@/components/ui/button` — `Button`, `ButtonLink`, `buttonClass` (variants: primary, accent, gold, outline, ghost, link, danger, light, **glass**, **tinted**; sizes sm 36px / md 44px / lg 52px). All are pills with press feedback.
- `@/components/ui/form` — `Input`, `Textarea`, `Select`, `Field`, `Checkbox`, `Radio`, `Label` (16px text on phones so iOS never zooms).
- `@/components/ui/misc` — `Badge` (tones incl. `pending`), `Card`, `CardHeader`, `EmptyState`, `Notice`, `Stat`, `PageHeader`, `Breadcrumbs`, `Tabs`, `Pagination`, `Container`, `SectionHeading`.
- `@/components/ui/table` — `Table`, `THead`, `Th`, `TBody`, `Tr`, `Td`.
- `@/components/ui/glass` — `Glass` (material surface: `material="ultrathin" | "thin" | "regular" | "thick" | "dark"`), `SegmentedControl` (link-based, works without JS), `Pill`, `iconButtonClass`.
- `@/components/ui/sheet` — `Sheet`: modal sheet on native `<dialog>` (top layer, focus trap, Escape, scrim click closes). `side`: `auto` (bottom sheet on phones, right panel from md), `bottom`, `right`, `left`, `top`, `center`. Optional `title`, `description`, sticky `footer`.
- `@/components/ui/toast` — `Toast`: dark glass toast above the phone tab bar, bottom-right on desktop.
- Store: `ProductCard`, `ArtisanStoryCard`, `VerifiedBadge`, `StarRating`, `TrustBadges`, `ReviewCard`, `RatingHistogram`, `LandedCostBreakdown`, `DeliveryEstimateLine`, `DestinationPicker`, `WishlistButton`, `CurrencySwitcher`, `MiniCart` (header cart; slide-over from md, opens after "Add to cart" via the `wb:cart-added` event), `MobileTabBar`, `CheckoutSteps` (bag → delivery → payment → confirmation), `HeroWordmark`.
- Icons: `lucide-react` named imports.
- Palette tokens: `indigo-*`, `terracotta-*`, `gold-*`, `sand-*`, `umber-*`, `turquoise-*`, `parchment`, `ink`. Surfaces: `.paper` (plain warm sand) and `.night` (plain deep indigo). The brand palette is for the storefront only.
- Type: headings and UI are Inter (`font-display` = Inter semibold with tight, size-aware tracking). Fraunces is `font-serif` and is kept for the wordmark, the `.gold-text` italic accents inside headings, and quotes. Urdu: `font-urdu`.
- Ornament: plain. No stars, hexagons, tile or scallop bands; the brand mark is a mehrab (arch). Artwork motifs are petal rosettes.
- Dashboards (`/admin`, `/seller`) use the shared neutral theme: the `.admin-theme` class on their layouts remaps the palette to grays/black and headings to sans, and maps the new button variants, press feedback and empty state back to the neutral look. Use the normal UI kit inside them; don't add colour or glass.
- Homepage (`src/app/(store)/page.tsx`) is calm and photography-led: the hero is only the 3D wordmark, one line and one button. The 3D haveli walk-through lives at `/haveli` (`src/app/(home)/haveli`); there is no 3D on product cards or product pages.
- Forms: server actions + `useActionState`, validate with `zod` (v4: `z.email()`), return `{ error }` or `{ ok, message }`.
- Copy: short. One line beats a paragraph; keep trust notes (landed cost, protected payment) brief and quiet. Buyers are in Pakistan and abroad — don't list countries; currency and shipping follow the chosen destination.

### Glass rules (storefront)

- Tokens live in `globals.css`: `--glass-ultrathin|thin|regular|thick|dark` tints, `--glass-blur-sm|blur|blur-lg`, `--glass-edge` highlights, radii `--radius-control` (14px) / `--radius-card` (22px) / `--radius-panel` (28px) / `--radius-sheet` (32px), shadows `shadow-soft|lift|float|sheet`, motion `ease-spring` (critically damped) and `ease-spring-bounce` (damping 0.8, sheets only), durations `--dur-press|quick|base|sheet`.
- Glass is for chrome and controls that float over content: header capsule, tab bar, sheets, menu, search, mini-cart, filter sheet, toasts, buy bars, chips/captions over imagery. Product photography, cards, forms and long text sit on solid surfaces.
- Never stack glass on glass. Text on light glass is `umber-800`/`umber-900` (or `terracotta-700`); on dark glass `sand-50`/`sand-100`. The tint alphas are chosen so that body text stays AA over any content.
- Use the classes (`.glass`, `.glass-thin`, `.glass-thick`, `.glass-dark`, …) or `<Glass>` — not raw `backdrop-blur-*`. They carry a solid fallback when `backdrop-filter` is unsupported, go solid under `prefers-reduced-transparency`, and solid with an outline under `prefers-contrast: more`.
- Motion: press feedback via `.pressable` (scale 0.97 on pointer-down). Sheets enter and exit along the same edge; under `prefers-reduced-motion` they cross-fade and the global rule shortens all transitions.
- Tap targets are at least 40–44px. On phones, primary actions sit at the bottom: the tab bar, the product buy bar and the cart checkout bar dock above it (the tab bar is hidden during checkout).
- Pages from new sections (e.g. `/brands`) pick the theme up automatically by using `Container`, `PageHero`/`InfoHeader`, the UI kit and `ProductGrid`.

## Admin visitor map

- `<VisitorMapSlot mode="background" | "card" tableFilterParam="place" />` from `@/components/admin/visitor-map` (also re-exported at `@/components/admin/visitor-map-slot`). It polls `GET /admin/api/analytics/map?range=&live=&hideDc=` (the `VisitorMapData` contract in `visitor-map/types.ts`); pass `dataUrl` to point it elsewhere and `compact` on table-heavy screens.
- Pinning a cross writes `?place=GB` (country) or `?place=GB:London` (place) with `router.replace`; the host page filters its table from that param. Esc clears it.
- `mode="background"` fixes the map behind the page and, scoped with `body:has([data-vm-background])`, makes that page's cards translucent. It keeps Wahbayaan's brand colours inside the neutral admin theme on purpose.
- Built-in map: Natural Earth countries from `world-atlas`; states/provinces from `public/geo/admin1.json`, generated by `node scripts/build-admin1.mjs` (Natural Earth 1:10m admin-1, filtered to the main visitor countries — no npm package ships admin-1 for Pakistan). Google Maps is used only when a browser key is saved in Admin → Settings → Visitor map.
- Demo on fixture data: `/admin/visitor-map` (dev only; `tests/fixtures/visitor-map.json` via `/admin/api/visitor-map/fixture`, a temporary route). Checks: `node scripts/e2e-visitor-map.mjs`, screenshots: `node scripts/shots-visitor-map.mjs` (both take `BASE`).

## Verification

- `npx tsc --noEmit`, `npx vitest run`.
- Screenshots: `node scripts/shot.mjs http://localhost:3000/path screenshots/name.png 1440 900 true`.
- Accessibility: run an axe-core WCAG 2 A/AA scan (`runOnly: ["wcag2a", "wcag2aa"]`) on changed storefront pages at 1440px and 390px, and check there's no horizontal scroll at 390px.
- 3D wordmark glyphs: `python3 scripts/wordmark-typeface.py` regenerates `src/components/store/hero/wordmark-typeface.ts`.

## Brand sellers, directory, partner links (`/brands/join`, `/brand-portal`)

- **Self-signup brands.** `/brands/join` records the application and a `brand_terms_acceptances` row (who, when, `BRAND_SELLER_TERMS_VERSION`; audited). Admin → Applications → Brands approves; `approveBrandApplication` (`src/lib/brand-portal/onboarding.ts`) creates the brand (or claims an unclaimed draft with that slug), the `brand_members` login and applies `permissionFromAcceptance` → `partnership = "authorised"` with the acceptance as the permission record. No acceptance / stale version → never authorised. Bump the terms version when `BRAND_SELLER_TERMS` changes.
- **Brand portal** (`src/app/brand-portal`, `src/components/brand-portal`): `.admin-theme`, PKR only (`SellerPrice`; covered by `tests/currency-surfaces.test.ts`). Pages call `requireBrandMember()`, actions `assertBrandMember()`, and every query is scoped by `brandId`. Brand accounts are `role = "seller"` without a vendor; `requireSeller()` sends them to the portal.
- **CSV upload** (`src/lib/brand-portal/csv.ts`, pure; `import.ts` writes): one row per variant, SKU identifies the variant, handle groups a product. Validate → preview → import; products with row errors are skipped, re-uploads are idempotent, photo-less "published" rows stay drafts. Refused without a recorded permission (logged as a `brand_sync_runs` row, trigger `portal`).
- **Fulfil hook**: the brand marks paid items ready (`markBrandItemsReady`, `brand_item_readiness`, staff-only order event). Shipping/hub logic subscribes with `onBrandItemsReady(fn)` in `src/lib/brand-portal/fulfil.ts` — don't add courier logic to the portal.
- **Directory** (`/brands/directory`, `brand_directory_entries`): text only — name, category, one factual line, nofollow website link, "Shop with Wahbayaan" → `/brands/request?brand=…`. The table has no contact columns; the seed reads only `brand`, `category`, `website` from `docs/outreach/pakistani-brands.csv`. Never imply a relationship. `ShopAnyBrandStrip` (`src/components/store/brands/shop-any-brand-strip.tsx`) is the homepage strip.
- **Affiliate programmes** (Admin → Affiliate programmes): CSV upload / CSV feed URL / manual entry only. Feed products and images show only when `affiliateDisplayGate` passes (recorded "terms allow display" + active + valid `{url}` template). Cards (`PartnerLinkCard`) link out with `rel="sponsored nofollow noopener noreferrer"`, are labelled "Partner link", show no Wahbayaan price and never enter the bag.
- **Social links**: `social_links` setting (Admin → Settings → Social links), validated per network (`src/lib/social.ts`); `SocialLinksList` renders monochrome inline SVG icons only for links that are set. Brand pages use `brand_profiles.socials`. No embeds or third-party scripts.
- **Compare**: brand products use their own cookie (`wb_compare_brands`) and table (`BrandCompareTable`): price range, sizes in stock, colours, fabric, delivery and service fee (pending stays pending).

## Brand outreach (`/admin/outreach`)

- Admin-only CRM for asking Pakistani brands for permission to list them: `outreach_contacts` (pipeline `new → contacted → replied → call_booked → negotiating → agreed | declined | do_not_contact`, owner, follow-up date), `outreach_templates`, `outreach_messages` (timeline: emails + manual events + status changes), `outreach_suppressions` (opted-out addresses). Permissions `outreach.view` / `outreach.manage` (Owner by default).
- **Contact details never leave the admin.** Only `src/app/admin`, `src/app/actions/admin`, `src/components/admin`, `src/lib/outreach`, the schema, the dashboard count and the opt-out page may touch outreach tables or modules — `tests/outreach-no-public-leak.test.ts` fails otherwise. The public directory still reads only brand/category/website from `docs/outreach/pakistani-brands.csv`.
- Import (button for the CSV in `docs/outreach`, or upload with the same columns) matches on the normalised brand name and is idempotent; contacts staff edited (`staffEditedAt`) only get blank fields filled. Pure logic: `src/lib/outreach/csv.ts`.
- Templates use `{brand}`, `{name}` (contact name or "{brand} team"), `{sender_name}`, `{sender_phone}`, `{site_url}`; sender details are the `outreach` setting (Templates screen). Sending is blocked until a sender name is set and on unknown `{fields}`.
- Every email goes through `sendEmail` (logged to the outbox when no provider is set — the screens say so) and ends with a fixed footer: business identity + one-click opt-out `/outreach/unsubscribe?t=…` (HMAC token, `src/lib/outreach/token.ts`). That page only marks the contact do-not-contact and suppresses the address.
- Skip rules (`src/lib/outreach/skip.ts`): do not contact, suppressed, no/invalid email are hard blocks; emailed in the last 5 days skips in bulk (max 20, sent sequentially) and needs an explicit "send anyway" for a single email.
- **Agreed ≠ authorised.** Marking a contact agreed only shows a prompt that opens the brand's permission form (creating a draft brand if none is linked) with a suggested note; the brand's recorded permission stays the single source of truth.
- Walkthrough: `BASE=http://localhost:3121 OUT=dir node scripts/e2e-outreach.mjs` (fresh demo seed, no email provider).
