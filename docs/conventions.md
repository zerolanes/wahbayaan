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

## Verification

- `npx tsc --noEmit`, `npx vitest run`.
- Screenshots: `node scripts/shot.mjs http://localhost:3000/path screenshots/name.png 1440 900 true`.
- Accessibility: run an axe-core WCAG 2 A/AA scan (`runOnly: ["wcag2a", "wcag2aa"]`) on changed storefront pages at 1440px and 390px, and check there's no horizontal scroll at 390px.
- 3D wordmark glyphs: `python3 scripts/wordmark-typeface.py` regenerates `src/components/store/hero/wordmark-typeface.ts`.
