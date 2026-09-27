# Step 0 — Orientation report

_Date: 2026-09-27_

## What the repository contained

`zerolanes/wahbayaan` was **empty**: no commits, no branches, no theme, plugin or
template files. There was nothing to inspect for the homepage category grid, vendor
directory, seller dashboard, product pages or menu overlay.

The live site (`wahbayaan.com`) could not be fetched from the build environment
(outbound access to that host is blocked by the environment's network policy), so
the audit below is taken from the redesign brief rather than re-verified live.

## Stack decision

The owner confirmed the previous site was WordPress + WooCommerce, running both the
Dokan and WCFM multi-vendor plugins, and asked for the marketplace to be rebuilt
from scratch as a custom application — not a WordPress theme — with:

- a Three.js homepage: a 3D home you move through on scroll, with the heritage
  crafts floating inside it;
- the full buyer storefront, the seller (artisan) dashboard, and a company admin
  panel that controls the whole system.

So this repository is a new codebase. Nothing from the WordPress install is carried
over; content (products, artisans, photography) has to be re-entered or imported
through the admin panel.

## Placeholder / demo content reported on the live site

None of this can ship silently in the new build. Each item is mapped to the guard
that prevents it.

| Live-site problem (from the brief) | Where it showed | Guard in the new build |
| --- | --- | --- |
| Gray "no image" category tiles: Posters & Prints, Wall Decor & Accessories, Stone Sculptures (Taxila), Customize | Homepage category grid | A category without a cover image is never rendered publicly (`isCategoryPublic`). The admin launch-readiness check lists it. |
| Every vendor shows the same "WAH BAYAAN MARKETPLACE" banner | Marketplace / vendor directory | A seller is public only when verified **and** has their own photo, story and a banner no other seller uses (`isVendorPublic`). |
| Demo vendors "wahbayaan", "offerove", "shafaq" with empty 0-star ratings | Marketplace / vendor directory | Seed data is flagged `is_demo`, hidden in production, and a sitewide "demo content" ribbon shows whenever demo data is visible. Sellers with no reviews show "New artisan — no reviews yet", never an empty 0-star bar. |
| "SELECT CATEGORY" header dropdown repeating the homepage circles | Header | Removed. Navigation is by craft, region and artisan, with search. |
| Unbranded plugin admin ("My Store", gray avatar, "Rs 0", empty chart) | Seller dashboard | Rebuilt as a Wahbayaan-branded, PKR-native dashboard with empty states that explain what to do next. |
| PKR shown with no buyer-side equivalent | Seller dashboard vs storefront | Buyer pages price in USD/GBP/CAD (PKR only through the explicit switcher); seller pages always price in PKR. Enforced by separate price components per surface. |
| Flat full-black text-only menu overlay | Main navigation | Replaced with a textured, image-led overlay in the new palette. |
| No currency switcher, landed cost, customs messaging, artisan stories, provenance or photo reviews | Sitewide | Built as first-class features (Steps 2–6). |

## Where things live in the new codebase

| Concern | Location |
| --- | --- |
| Homepage (3D) | `src/app/(store)/page.tsx`, `src/components/three/` |
| Category grid / category pages | `src/app/(store)/category/[slug]/` |
| Marketplace / artisan directory | `src/app/(store)/artisans/` |
| Product pages | `src/app/(store)/product/[slug]/` |
| Menu overlay | `src/components/store/menu-overlay.tsx` |
| Seller dashboard | `src/app/seller/` |
| Company admin panel | `src/app/admin/` |
| Public-visibility guards | `src/lib/trust/visibility.ts` |
| Landed-cost engine | `src/lib/commerce/landed-cost.ts` |
