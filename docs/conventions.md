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

## Auth

- Buyer pages: `await requireUser("/account/...")`.
- Seller pages: `await requireSeller()` (layout already does it; actions must re-check and scope every query by `user.vendorId`).
- Admin pages: `await requireStaff("orders.view")`; admin server actions: `const user = await assertStaff("orders.manage")` then `await audit({...})`.

## UI kit

- `@/components/ui/button` — `Button`, `ButtonLink` (variants: primary, accent, gold, outline, ghost, link, danger, light).
- `@/components/ui/form` — `Input`, `Textarea`, `Select`, `Field`, `Checkbox`, `Radio`, `Label`.
- `@/components/ui/misc` — `Badge` (tones incl. `pending`), `Card`, `CardHeader`, `EmptyState`, `Notice`, `Stat`, `PageHeader`, `Breadcrumbs`, `Tabs`, `Pagination`, `Container`, `SectionHeading`.
- `@/components/ui/table` — `Table`, `THead`, `Th`, `TBody`, `Tr`, `Td`.
- Store: `ProductCard`, `ArtisanStoryCard`, `VerifiedBadge`, `StarRating`, `TrustBadges`, `ReviewCard`, `RatingHistogram`, `LandedCostBreakdown`, `DeliveryEstimateLine`, `DestinationPicker`, `WishlistButton`, `CurrencySwitcher`.
- Icons: `lucide-react` named imports.
- Palette tokens: `indigo-*`, `terracotta-*`, `gold-*`, `sand-*`, `umber-*`, `turquoise-*`, `parchment`, `ink`. Surfaces: `.paper` (parchment grain) and `.night` (plain deep indigo). Display font: `font-display` (Fraunces); Urdu: `font-urdu`. The brand palette is for the storefront only.
- Ornament: plain. No stars, hexagons, tile or scallop bands; the brand mark is a mehrab (arch). Artwork motifs are petal rosettes.
- Dashboards (`/admin`, `/seller`) use the shared neutral theme: the `.admin-theme` class on their layouts remaps the palette to grays/black and headings to sans. Use the normal UI kit inside them; don't add colour.
- Homepage (`src/app/(store)/page.tsx`) is flat and photography-led. The 3D haveli walk-through lives at `/haveli` (`src/app/(home)/haveli`); there is no 3D on product cards or product pages.
- Forms: server actions + `useActionState`, validate with `zod` (v4: `z.email()`), return `{ error }` or `{ ok, message }`.

## Verification

- `npx tsc --noEmit`, `npx vitest run`.
- Screenshots: `node scripts/shot.mjs http://localhost:3000/path screenshots/name.png 1440 900 true`.
