# Wahbayaan

A cross-border heritage marketplace: Pakistani calligraphers, weavers, carvers and craftspeople list handmade work, and buyers in the US, UK and Canada buy and import it — with the **full landed cost** (item + shipping + duty + tax + handling) shown before they pay and their **payment held** until the piece arrives.

This repository is a from-scratch rebuild (the previous site was WordPress + WooCommerce + Dokan/WCFM). See [`docs/00-orientation.md`](docs/00-orientation.md).

## What's inside

| Area | Path | Notes |
| --- | --- | --- |
| Storefront (buyers) | `src/app/(home)`, `src/app/(store)` | 3D homepage, shop, crafts, artisans, product pages, cart, checkout, account. Prices in USD / GBP / CAD (PKR only via the switcher). |
| Artisan dashboard | `src/app/seller` | Listings, orders, custom requests, payouts. Always PKR. |
| Company admin | `src/app/admin` | Orders, escrow, disputes, artisans & verification, listings, rates, content, staff roles, audit log, launch readiness. |
| Landed-cost engine | `src/lib/commerce/landed-cost.ts` | Pure function; pending rates are shown as pending, never as zero. |
| Trust guards | `src/lib/trust/visibility.ts` | Categories without covers, unverified or template-banner artisans and demo rows never reach the storefront. |
| 3D | `src/components/three` | Procedural heritage objects (rugs, calligraphy, pottery, stone, salt, wood…) built in Three.js. |
| Heritage art | `src/lib/art`, `/art/<kind>/<seed>.svg` | Procedural illustrations used for demo content and category art until real photography is uploaded. |

## Run it locally

Requirements: Node.js 20.9+ (22 recommended). No database server is needed for development — an embedded Postgres (PGlite) is stored in `.data/`.

```bash
npm install
cp .env.example .env          # DEMO_MODE=true shows the sample catalogue
npm run db:reset -- --demo    # create the database and load demo data
npm run dev                   # http://localhost:3000
```

Demo sign-ins (password `wahbayaan-demo`):

| Role | Email |
| --- | --- |
| Company owner (admin) | `admin@wahbayaan.test` |
| Buyer (US) | `buyer@wahbayaan.test` |
| Artisan | `noor-calligraphy-atelier@artisans.wahbayaan.test` |

> Stop `npm run dev` before running `db:*` scripts — the embedded database allows one process at a time.

### Production

Set `DATABASE_URL` to a Postgres database (migrations run automatically on first connection), set `DEMO_MODE=false`, and create the first owner account with `ADMIN_EMAIL` / `ADMIN_PASSWORD` then `npm run db:seed`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build && npm start` | Production build |
| `npm test` | Unit tests (landed cost, currency, visibility guards, currency surfaces) |
| `npm run typecheck` | TypeScript |
| `npm run db:reset -- --demo` | Rebuild the embedded dev database with demo data |
| `npm run db:seed` | Base data (taxonomy, roles, FAQ, pending rate tables) |
| `npm run db:generate` | Generate a migration after editing `src/lib/db/schema.ts` |

## Business inputs still needed

The software is complete enough to run, but these numbers are business decisions and are deliberately **pending** until supplied (Admin → Cross-border / Settings):

- Exchange-rate provider (or manual rates) — demo uses clearly labelled placeholder rates
- Courier contracts and rate cards (DHL / FedEx / Aramex)
- Duty & import-tax rates per destination and HS code (from a customs broker)
- Wahbayaan handling fee, artisan commission, gift-wrap price
- Buyer-protection window, escrow auto-release period
- Stripe / PayPal accounts (without keys, checkout runs in a clearly labelled test mode)
- Legal review of terms and privacy policy
- Real product and artisan photography (the launch-readiness page lists every illustration still in use)
