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

## Honesty rules

- Rates without real data (shipping, duty, tax, handling, commission, gift wrap) are `pending`. Show "Pending" / "Pending real rate data", never `0` and never an invented number.
- Demo rows have `isDemo = true`. Anything shown to buyers goes through the guards in `src/lib/queries/catalog.ts` (which use `src/lib/trust/visibility.ts`). Do not query `products`/`vendors`/`categories` directly for public listings.
- Artwork from `/art/...` is an illustration standing in for photography. Customers never see QA labels ("Illustration", "Demo content", "Sample review", demo logins): they render only when the build sets `NEXT_PUBLIC_WB_QA_LABELS=1` (`SHOW_QA_LABELS` in `src/lib/qa.ts`). The admin launch-readiness check lists every illustration that still needs a real photo before launch.
- Shipments over `FREIGHT_THRESHOLD_G` (70 kg — furniture, snooker tables) are freight: shipping stays `pending` with a freight explanation until logistics quotes it.

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
