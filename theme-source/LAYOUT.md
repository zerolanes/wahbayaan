# The old wahbayaan.com: layout reconstruction

This document rebuilds the old WordPress site's layout from its WordPress export: `theme-source/wahbayaan.WordPress.2026-10-12.xml`, which is git-ignored and never committed. There was no theme .zip and no live site to look at. Everything below comes from the Elementor data, the WoodMart layouts and blocks, the menus, the slider settings and the page settings in the export. Where the export doesn't hold a setting, this file says **(not in export)** and gives the best inference.

Related files:

- [`layout.json`](layout.json): homepage section order and settings, machine-readable.
- [`content-inventory.md`](content-inventory.md) and [`content.json`](content.json): all text, marked REAL or DEMO.
- [`images.md`](images.md): all 276 media files, classified, plus the fonts and their licences.

> **The short version.** The old site was the WoodMart **"Furniture 2"** Elementor demo, imported in 2025. Leftovers from an even older **Basel** demo (2017) are mixed in. The owner then re-skinned part of it for Wahbayaan. The real parts are the hero slider (3 slides), the homepage headings, the category list, the About story, the Contact copy, the footer and the main menu. Everything else is still the furniture demo: every product, every blog post, the "Shop by Artists" cards, the lookbook, "Rules for choosing furniture", the Showrooms and Gift-cards pages and the shop, product and cart templates. **No real product, seller or blog post was ever published.**

---

## 1. Overview

### Platform and plugins detected

| Item | Detected | Evidence |
|---|---|---|
| WordPress | 7.1.3 | export header |
| Theme | **WoodMart 8.2.0** by xtemos, with child theme `woodmart-child` (an earlier WoodMart 7.6.0 install was upgraded) | slider CSS meta `xts-term-89-version 8.2.0`, custom CSS post `woodmart-child` |
| Demo imported | WoodMart **"Furniture 2" (Elementor)** prebuilt site | `wd-furniture-*` media, "Furniture 2" slide/layout names, `dummy.xtemos.com/woodmart2/furniture2-elementor` links |
| Older leftovers | **Basel** theme demo (xtemos, 2017) with WPBakery shortcodes | `_basel_*` meta, `[basel_title]`, `[vc_row]` in products, CMS blocks and portfolio |
| Page builder | **Elementor 3.29.2** (flexbox containers) | `_elementor_version` |
| Shop | **WooCommerce** (with product brands, colour attribute, variations) | product posts, `product_brand`, `pa_color` |
| Marketplace | **WCFM Marketplace** (store list, Frontend Manager, vendor membership and registration, knowledgebase) **and Dokan** (vendor dashboard, "My Orders", reverse-withdrawal product), installed together | `[wcfm_stores]`, `[wc_frontend_manager]`, `[wcfm_vendor_membership]`, `[wcfm_vendor_registration]`, `[dokan-dashboard]`, `[dokan-my-orders]`, Dokan dashboard CSS |
| Forms | Contact Form 7 (2 forms), Mailchimp for WP (1 newsletter form) | `wpcf7_contact_form`, `mc4wp-form` |
| Order tracking | Two different plugins: **TrackShip** (`[trackship-track-order]`) and one using `[pp-track-page]` (probably ParcelPanel), plus an empty "Orders Tracking" page | pages `/tracking/`, `/track-your-order/`, `/orders-tracking/` |
| Other | Slider Revolution (its CSS loads, but no slider is used), the WordPress Font Library (fonts from Twenty Twenty-Five, unused) | `rs_page_bg_color`, `revolution-slider` CSS module, `wp_font_family` |
| WoodMart features switched on | Header banner (top strip), AJAX search with category filter and search history, login dropdown and account sidebar, side cart, free-shipping progress bar, estimated delivery, wishlist, compare, size guide, "Frequently bought together", promo popup, mobile bottom toolbar, scroll-to-top | the `wd_page_css_files` module list on every page |

### Breakpoints (Elementor kit)

- **Mobile**: up to 768 px (`viewport_mobile` 768.98).
- **Tablet**: 769–1024 px (`viewport_lg` 1025).
- **Desktop**: 1025 px and up. The extra breakpoints (mobile-extra, tablet-extra, laptop, widescreen) are switched on but never used.
- Kit container padding: 0.

### Global colours

The WoodMart Theme Settings (global colours, fonts, header) live in `wp_options`, and a WordPress export does not include them. The Elementor kit still has Elementor's factory colours (#6EC1E4, #54595F, #7A7A7A, #61CE70), which the WoodMart widgets never use. The palette below is therefore **inferred from colours set directly on widgets**:

| Role | Hex | Where it appears |
|---|---|---|
| Page background (warm off-white) | `#F3F2EE` | Fade colour of every "Read more" block, which matches the page background. This is the Furniture-2 demo background. |
| Card / surface | `#FFFFFF` | Product cards, category cards, shop sidebar, reviews and cart boxes. Cards sit on the off-white page. |
| Heading text | `#242424` | Tab titles; WoodMart's default title colour |
| Secondary text | `#777777` | Hover tab text; WoodMart's default |
| Hairline / divider | `#0000001C` (black at 11%) | Dividers on the product page, infobox hover |
| Light border | `#EFEFEF`, `#EBEBEB` | Checkout and cart boxes, the add-to-cart border |
| Dark button | `#101010` (hover `#242424`) | Infobox buttons |
| Step badge | `#363636` | Checkout step numbers |
| Accent (Furniture-2 demo) | `#F59A57` (orange; tints `#F59A571A`, `#F59A5733`) | Checkout step badges and notes, cart infobox icons |
| Accent (owner-set) | `#3B96E3` (blue) | Homepage "Bestsellers" tab accent |
| Muted teal | `#63848C` | Shop sidebar promo banner (demo) |
| Overlay | `rgba(0,0,0,.3)` = `#0000004D` | Hero-button hover background, logo drop-shadow |
| Faint tint | `#1010100D`, `#10101008` | Checkout step bars, infobox backgrounds |

The colour-attribute swatches (Venetian Red `rgb(204,21,18)`, Queen Blue `rgb(69,98,136)`, Marigold `rgb(225,152,31)`, Bone `rgb(225,218,207)`, French Bistre `rgb(127,111,75)` and others) are product filters, not brand colours.

### Fonts and sizes

All fonts are Google Fonts (free, OFL) except one Helvetica reference. Global body and heading fonts are **(not in export)**. The sizes below come from the widgets themselves:

| Use | Font | Desktop / tablet / mobile | Weight |
|---|---|---|---|
| Homepage section titles (Our Collections, Shop by Artists, Crafted Heritage) | **Russo One** | 40 / 26 / 22–26 px | 400 |
| Homepage section subtitles | theme body font | default; 8–10 px on mobile (set that small on purpose, which is too small to read) | — |
| "Bestsellers" heading | Anton | 30 / 26 / 26 px, capitalised | 400 |
| Product-tab labels | Cairo | default, capitalised | — |
| Hero slide 2 headline | Genos | 36 / — / 17 px | default |
| Hero slide 3 headline | Do Hyeon | 70 / — / 50 px | 800 |
| Inner-page titles (About, Contact) | **Playfair Display** | 32 / 26 / 22 px | 700 on About |
| Region headings (About: The South / The North) | Unbounded | 28 px | default |
| Body copy (About, Contact, Showrooms) | **Urbanist** | 14 px (About), 17 px (Contact intro) | 400 |
| Demo homepage section titles ("Latest articles" and others) | theme heading font | 32 / 26 / 22 px | — |
| Product title (single product) | theme | 28 / 24 / 22 px | — |
| Product price (single product) | theme | 34 / 28 / 22 px | — |
| Category names (homepage circles) | theme | 20 / 18 px, capitalised | 200 |
| Footer column titles | Candal (one uses Helvetica) | default; 15 px on mobile | — |
| Footer links | AR One Sans | default; 10 px on mobile | — |
| Seller "Store Dashboard" title | Murecho | 50 px | 800 |

The site used **about 15 different font families** with no system behind them. Russo One, Anton, Genos, Do Hyeon and Candal are display faces picked one widget at a time. The only consistent pair was **Playfair Display for headings and Urbanist for body text** on the owner-written inner pages.

### Container width, spacing, buttons, radius

- **Content width:** slides are 1200 px wide (500 px on mobile). WoodMart's site-width setting is (not in export); WoodMart's default is 1222 px. Most sections are "boxed" (theme width). Sections 6 (lookbook) and the About video band stretch full width with 20 px side padding (15 px on tablet).
- **Section spacing** (bottom margin, desktop / tablet / mobile): 100 / 80 / 60 px for major sections, 80 / 60 / 40 px for minor ones, and 110 / 80 / 60 px under "Our Collections". The hero has a −40 px top margin, which pulls it up under the header.
- **Gaps used:** 10, 15, 20, 30, 40, 60 px. Cards have 20 px padding (25 px in checkout).
- **Buttons** (WoodMart `wd_button`):
  - Hero buttons: white background, dark text. On hover the background turns translucent black `rgba(0,0,0,.3)` with white text. Sizes are default and extra-large.
  - "Visit the Blog", "Make a route" and "Buy now": `shape: round` (pill), white or primary, with a 16×17 px long-arrow SVG icon.
  - "Read More": link style in the primary colour.
  - Add-to-cart: full width.
- **Radius:**
  - 10 px on every white card (shop sidebar, reviews, cart and checkout boxes, "Frequently bought together").
  - 200 px on the "pill" video bands (homepage §9, About).
  - 50% (circles) on homepage category images.
  - 12 px in the Dokan dashboard CSS.
- **Shadows:** almost none. The hero logo has `0 25px 50px 15px rgba(0,0,0,.3)` and the Dokan cards have `0 2px 5px #00000020`.
- **Custom CSS (child theme):** only re-styles the Dokan vendor dashboard: white cards, 12 px radius, black text, black-outline buttons, and the purple highlight removed.

---

## 2. Homepage (`/`, page "Home", ID 15)

Page settings: title bar off, full-width layout (no sidebar), global header and footer. Eleven sections plus one empty container, top to bottom. Section IDs are the Elementor container IDs, the same ones used in `layout.json`.

### §1 Hero slider (`26e8d44`), REAL

- **Widget:** `wd_slider`, showing WoodMart slider "Furniture 2 slider" (3 slides).
- **Slider settings:**
  - Transition: **parallax**.
  - **Autoplay on, 20 s per slide** (`autoplay_speed` 20000).
  - Stretched full width.
  - Height **600 px desktop, 500 px tablet, 500 px mobile** (min-height).
  - Arrows style 3 (no hover effect). Pagination style 3, centred, dark.
- **Layout:** one container with margins −40 / 0 / 100 / 0 (tablet bottom 80, mobile bottom 60).
- **Each slide:**
  - Content box 1200 px wide (1200 tablet, 500 mobile), centred vertically and horizontally on every breakpoint.
  - Fallback colour `rgb(176,179,168)`. Per-slide animation: none.
  - Backgrounds are `cover`. On smaller screens the background is shifted left (tablet x −120 px, mobile x −360 px) to keep the subject in view.

| Slide | Background | Content (top to bottom) |
|---|---|---|
| 1 | Pexels stock photo (`pexels-wasifmehmood997-…`) | Wahbayaan wordmark image (`Wahbayaan-1-1.png`, full width; 80% on mobile; big drop shadow) → 50 px spacer → **"Shop Now"** button → `/shop/` |
| 2 | Pexels stock photo (`pexels-yunustug-…`, anchored centre-bottom on tablet and mobile) | Wordmark/banner image (`image-5-1-modified.png` at 700×100) → heading **"SHOP BY OUR SELLERS"** (Genos 36 px, 17 px mobile, near-white) → spacer → **"Marketplace"** button → `/marketplace/` (350 ms delay) |
| 3 | `10-6.jpg` (origin unknown) | Heading **"OUR STORIES"** (Do Hyeon 70 px / 50 px mobile, weight 800, white) → spacer → **"About us"** button, extra-large, entrance animation **slide-from-bottom**, 350 ms delay → `/about-us/` |

### §2 "Our Collections": category circles (`7ddcdd5`), REAL

- **Widgets:** `wd_title` (style *bordered*, size large) + `wd_product_categories`.
- **Heading:** "Our Collections". Subtitle: "Browse a wide range of handcrafted pieces across all our categories. New collections are added regularly — discover something made just for you."
- **Categories**, in this order:
  1. Calligraphy Art
  2. Paintings
  3. Handmade Carpets & Rugs
  4. Salt Art & Decor
  5. Stone sculptures [Taxila]
  6. Customize
  7. Wall Decor & Accessories
  8. Posters & Prints
  
  Empty categories still show. Each card shows a product count ("1 product").
- **Cards:** round thumbnail images (radius 50%), white card background, names 20 px (18 px tablet), weight 200, capitalised.
- **Columns:** desktop = widget default (not set). **Tablet 4, mobile 3.**
- **Spacing:** bottom margin 110 / 80 / 60.

### §3 "Bestsellers": tabbed product grid (`28521a5`), MIXED

- **Widget:** `wd_products_tabs`, design *simple*, accent `#3B96E3`, heading in Anton 30 px, tab labels in Cairo.
- **Tabs:** All (best-selling, hand-picked product IDs) · Calligraphy Art · Salt Art · Stone Sculptures · Wall decor · Customized.
- **Grid:** **5 columns desktop, 3 tablet** (mobile = default). 10 items per tab. Images cropped 350×400. White cards in a bordered grid, no shadow.
- **Content:** the tab names are real; the products in them are demo products. Most hand-picked IDs no longer exist (see §8).
- **Spacing:** gap 10 px; bottom margin 80 / 60 / 40.

### §4 "Shop by Artists": five tall cards (`85ab481`), MIXED (real heading, demo cards)

- **Widgets:** `wd_title` (bordered, Russo One 40 / 26 / 22) + 5 × `wd_infobox`, style *bg-hover*, light scheme.
- **Heading:** "Shop by Artists". Subtitle: "Paintings rooted in heritage, crafted by artists across Pakistan."
- **Each card:**
  - 64×64 round logo at top-left, title 22 / 18 px, a one-line "city / country" subtitle.
  - Full-bleed background photo (cover). Bottom padding 310 px makes the cards tall.
  - Hover overlay `#0000001C`. Links to `/shop/?filter_brand=…`.
- **Layout:** desktop **5 × 20%** in a row. Tablet **2 × 50%**, wrapping, 10 px inner margins, 20 px row gap. Mobile **100%**, stacked. **The 5th card is hidden on tablet and mobile.**
- **Content:** all five cards are WoodMart demo furniture brands (Elitis, Hay, Kettal, Llardo, Poliform). The section was meant to list sellers and was never filled.

### §5 "Crafted Heritage" heading (`06232b0`), REAL

- **Widget:** `wd_title` (bordered, Russo One 40 / 22).
- **Text:** "Crafted Heritage". Subtitle (blockquote): "Moments, textures, and details that carry the spirit of Pakistani craftsmanship."
- **Spacing:** bottom margin 30 / 10.

### §6 Lookbook mosaic (`3ed7aae`), DEMO

- **Widgets:** 8 × `wd_image_hotspot` + 2 × `wd_banner`.
- **Width:** full-bleed (*stretch-content*), side padding 20 px (15 px tablet).
- **Columns:** five, each **20%** wide, each a vertical stack of two items:
  - Column 1: hotspot photo + hotspot photo.
  - Column 2: hotspot photo + short banner "GLADØM" (186 px).
  - Column 3: hotspot **video** (mp4 with poster) + hotspot photo.
  - Column 4: banner "HÄLLAN" + hotspot photo.
  - Column 5: two hotspot photos. **The whole column is hidden on tablet and mobile.**
- **Responsive widths:** tablet 50% (2 per row, wraps, 20 px row gap); mobile 100% (stacked).
- **Hotspots:** 3 pins per image, icon shows on hover, pin colour `#FFFFFF4D`. Every pin says "Title, click to edit." with lorem ipsum and links to a product.
- **Reusable part:** only the idea, a shoppable lookbook of studio photos. Every image and word here is demo.

### §7 "Furniture collection of the week" (`b0c1d74`), DEMO

- **Layout:** two columns, **66.6% / 33.4%**. Tablet 50 / 50; mobile stacked 100%. Gap 30 px column, 40 px row. Vertically centred.
- **Left column:** title (32 / 26 / 22 px, left-aligned) + `wd_products` **carousel** of 3 hand-picked top-rated products, 350×400 images, no pagination dots. Slides per view: tablet 2, mobile 2.
- **Right column:** one image hotspot.

### §8 "Rules for choosing furniture" heading (`45ab4ee`), DEMO

- **Widget:** `wd_title`, 32 / 26 / 22 px, left-aligned. Bottom margin 10.

### §9 Image + text + video pill (`66428ad`), DEMO

- **Layout:** **42% / 58%** row. No tablet or mobile overrides, so the columns stay side by side on phones (a flaw).
- **Left column:** an illustration PNG.
- **Right column:**
  - H4 + paragraph, then a 3-item list with a 6 px dot bullet SVG.
  - A **pill card**: border-radius 200 px, padding 90 px 15 px, cover photo background. It holds a white title "SØLREM furniture collection" (subtitle "How choose furniture", 18 px) and a YouTube **play button** (80 px, white at 90%, 60% on hover).

### §10 "Latest articles": blog carousel (`0d84707`), DEMO content, generic structure

- **Header row:** title "Latest articles" on the left and a round white **"Visit the Blog"** button with an arrow icon on the right (space-between).
- **Carousel:** `wd_blog`, design *meta-image* (author, category and date over the image), 5 posts, 20 px spacing. Slides per view **4 / 3 / 1**. No dots.
- **Content:** the six demo posts.
- **Spacing:** bottom margin 80 / 60 / 40.

### §11 SEO text with "Read More" (`35a30bd`), DEMO

- **Content:** H3 headings and paragraphs about "an online store with a wide selection of furniture and decor".
- **Collapse:** the container is a WoodMart *collapsible content* block, cut off at **330 px (216 px tablet)** with a fade into `#F3F2EE`. A "Read More" link button expands it.

### §12 Empty container (`dfc11fa`)

A leftover with nothing in it.

**Animation summary:**

- The slider uses parallax and 20 s autoplay.
- Slide 3's button slides in from the bottom; slide 2 and 3 buttons have a 350 ms delay.
- Hotspot icons appear on hover; cards darken on hover.
- No other entrance animations, sticky sections or parallax backgrounds on the homepage.

**What the old homepage was trying to be**, read from the real parts: a full-screen photographic hero → craft categories → bestsellers by craft → sellers/artists → a "Crafted Heritage" visual story → journal → long-form SEO text. That order fits the new storefront's editorial homepage.

---

## 3. Header and menus

The **header itself is not in the export.** The WoodMart Header Builder keeps headers in `wp_options` (`whb_saved_headers`), and every page uses the global header (`_woodmart_whb_header: none`). The structure below is reconstructed from the CSS modules WoodMart loaded on each page and from the menus:

| Part | What the export shows |
|---|---|
| Top strip | **Header banner** (`header-banner` module): a dismissible promo strip above the header. Its text is (not in export). |
| Top bar | Probably "Top bar menu Furniture 2": Gift cards · Showrooms · About us. These are demo pages. Also the **currency/country switcher** "PAK" ▸ Canada · USA · Pakistan. Every switcher link is `#` (not wired), and "PAK" shows the demo **EU flag** SVG. |
| Logo | The Wahbayaan wordmark. Candidates: `Wahbayaan-1-1.png` (725×233, also used in the footer and slide 1) and a Customizer crop `cropped-Wahbayaan-1-1-1-Photoroom…png` (447×150). The site icon is `cropped-cropped-Wahbayaan-1-1-1-1.jpg` (512×512). |
| Main menu (desktop) | **"Main Menu Primary"** (owner-built): **Shop** → `/shop/` · **Marketplace** → `/marketplace/` · **Compare** → `/compare/` · **About us** → `/about-us/` · **Contact us** → `/contact-us/`. All open on hover, default design, no mega-menus. The demo "Main navigation" menu (Home, Pages ▸ portfolio demos, Elements ▸ WooCommerce / Xtemos Elements / More Elements) also exists; three of its children point at a parent item that is missing from the export. |
| Search | AJAX product search **with a category dropdown**, live result dropdown and **search history** (`header-search-form`, `wd-search-cat`, `wd-search-dropdown`, `opt-search-history`). |
| Icons | **Account** (login form dropdown + account sidebar), **Cart** (count + **side cart** drawer with free-shipping progress bar). Wishlist and compare pages exist; header icons for them are likely but (not in export). |
| Sticky | (not in export). |
| Mobile | Hamburger → **dropdown mobile nav** (`header-mobile-nav-dropdown`) using **"Mobile navigation"**: Home · Blog · About us · Contact us · Showrooms · Gift cards (the last two are demo pages). A **full-screen menu** module also loads. A **mobile bottom toolbar** (WoodMart's sticky shop/wishlist/cart/account bar) and a **scroll-to-top** button are on. |
| Header mega-menu blocks | CMS blocks "Menu 'Shop'", "Menu 'Home'" and "Menu 'Categories'" exist, but they are Basel demo blocks (shop styles, "MENU TITLE" placeholders, fashion categories) and no menu item uses them. |

---

## 4. Footer (CMS block "Footer", ID 688), mostly REAL

- **Wrapper:** padding 50 px top and bottom (mobile 50 / 20). Background and colour scheme are (not in export). The white label text and coloured social icons suggest a **dark footer**.
- **Columns:** two at the top level, **75% / 25%** (tablet 58.3 / 41.7; mobile 100%, stacked). Gaps: 20 px column, 30 px row.

**Left column (75%)**

- **Wahbayaan wordmark** (`Wahbayaan-1-1.png` at 350×90, links to `#`).
- Then a three-column link row (33 / 33 / 33%; tablet 41.6 / 33.3 / 25; mobile 100 / 46 / 46), aligned to the bottom:
  1. **Useful links** (Candal title): Shop · Marketplace · About us · Contact us · Become a seller (→ `/my-account/`).
  2. **Categories**: Calligraphy Art · Paintings · Handmade Carpets & Rugs · Posters & Prints · "Salat Art & Decor" (typo for Salt).
  3. No title: Stone Sculptures (Taxila) · Furnitures · Antique Art · Customized. The last three point at categories that don't exist.
- Link text: AR One Sans, 10 px on mobile.

**Right column (25%)**

- **Social buttons**: label "Subscribe us:" (22 / 20 / 14 px, white), style *colored*, small, inline. Facebook `facebook.com/wahbayaan`, Instagram `instagram.com/wahbayaan.shop` [verify: the Contact page says `@wahbayaan.store`], Pinterest `pinterest.com/wahbayaan`.
- **"Download App on Mobile:"** heading with "Coming Soon!" underneath. Below it, the demo **Google Play** and **App Store** badges (125×40) linking to `#`. They sit in a column on desktop and tablet and in a centred row on mobile.

There is no copyright bar in the export; WoodMart's copyright text is a theme setting (not in export). The Store Manager page hides the footer, pre-footer and copyright.

---

## 5. Inner page templates

| Template | Old URL | Source | Status | Structure |
|---|---|---|---|---|
| **About us** | `/about-us/` | Elementor page 31 | **REAL copy** + stock/web photos | ① 66.6 / 33.4 row, reversed on tablet and mobile (text first): left a 2-column image gallery (two Pexels photos, 20 px spacing); right "Crafted Heritage" (Playfair Display 32 px, 700) + story paragraph (Urbanist 14 px). Bottom margin 100 / 80 / 60. ② "Crafted Across Pakistan" title + intro ("From the calm of Hunza to the chaos of Karachi…"). ③ Three columns **25 / 50 / 25**: "The South" (Unbounded 28 px + text) · centre photo (height 450 px, a Facebook-sourced image) · "The North" (heading + text). No responsive overrides. ④ Spacer. ⑤ Video band: section padding 10% left and right (0 on tablet); inner pill card (radius 200 px, padding 100 px 0, Pexels background with black overlay) with subtitle "Dive into Diversity", title "Explore the rich cultures of Pakistan" (white, Playfair Display) and a YouTube play button (`0fJBbSTfZ7Q`). ⑥ An empty collapsible "Read More" (the demo text was removed but the button was left). |
| **Contact us** | `/contact-us/` | Elementor page 29 | **REAL copy, DEMO FAQ** | ① Row 50 / 50, gap 30 / 40: left "Drop us a Message" (Playfair Display 32 / 26 / 22) + Contact Form 7 form (Name, Email, Reason [General Inquiry / Order or Shipping / Custom Art Request / Artist Collaboration / Feedback / Other], Message, "Send Message"); right "We're easy to reach" (Playfair) + intro (Urbanist 17 px) with **support@wahbayaan.com [verify]**, **Instagram @wahbayaan.store [verify]**, "We usually respond within 24 hours", "If you're an artist, a collaborator, or just curious — you're welcome here too." ② Spacer. ③ "Frequently asked questions" + accordion with 5 delivery questions. **The answers are placeholder text.** |
| **Marketplace** (vendor list) | `/marketplace/` | Elementor page 32244 | REAL (dynamic) | Title bar off (title image = Wahbayaan SVG). ① Full-width wordmark/banner image (`image-5-1-…png`, 1505×332). ② `[wcfm_stores]`: the WCFM store-list grid, rendered by the plugin. Its layout and vendor data are (not in export). |
| **Vendor store page** | `/store/<store>/` (WCFM default base) | WCFM plugin template | (not in export) | No WoodMart layout targets store pages. The WCFM default is: store banner + logo + name + rating + contact/social, tabs (Products, About, Policies, Reviews, Followers), product grid with a sidebar. |
| **Seller pages** | `/dashboard/`, `/store-manager/`, `/seller-membership/`, `/seller-register/`, `/my-orders/` | Dokan / WCFM shortcodes | SYSTEM | Dashboard: "Store Dashboard" (Murecho 50 px, 800) + `[dokan-dashboard]`, styled by the child-theme CSS. Store Manager: `[wc_frontend_manager]` with header title, footer, pre-footer and copyright all hidden. Membership and registration: WCFM forms. Two vendor systems ran side by side. |
| **Shop / category archive** | `/shop/`, `/product-category/…/` | WoodMart layout 1034 "Shop archive layout Furniture 2" (applies to all archives) | DEMO styling, generic structure | ① Full-width page title (−40 px top margin). ② Row **25 / 75**. Left: **off-canvas column** on tablet and mobile (opened by a "Show column" button) holding the `sidebar-shop` widget area (white card, 20 px padding, 10 px radius) + a demo promo banner (520 px, teal content box). Right: a toolbar row (result count 34%, hidden on tablet and mobile; per-page 9/12/18/24, hidden on tablet and mobile; grid/list view switcher 3/4/list, hidden on tablet and mobile; sort-by with a mobile icon), active filters, notices, then the **product grid: 3 columns desktop, 3 tablet, 2 mobile**, white cards, images 400×457. ③ Demo SEO text with "Read More". |
| **Single product** | `/product/<slug>/` | WoodMart layout 711 "Single product layout Furniture 2" (all products) | DEMO styling, generic structure | ① White full-width band (padding 20 px 15 px 40 px): breadcrumb + previous/next product nav (hidden on mobile), notices. Then a row **58.3 / 41.7**, both columns **sticky** on desktop and tablet, stacked on mobile. Left: product gallery (with video support). Right: title (28 / 24 / 22, 78%) + brand badge (22%), meta, rating, a demo promo infobox ("Apple Shopping Event"), short description, price (34 / 28 / 22) + stock status, countdown, stock progress bar, add-to-cart (full width), hook, divider, compare / wishlist / size-guide buttons, divider, accordion ("Shipping and returns", "Product care", …, all lorem). ② "Frequently Bought Together" (white card, 10 px radius). ③ White card, two columns: "Product details" (text + attributes table) / "Description" (product content, sticky). ④ Brand information card + "Customer Reviews" (two-column reviews). ⑤ "Related Products" carousel (6 items, 5 per view). ⑥ Demo SEO "Read More" text. |
| **Cart** | `/cart/` | WoodMart layout 1066 "Cart layout Furniture 2" (published). "New Cart" (32208) is a draft. | DEMO copy | Row **66.6 / 33.4** (stacked on tablet). Left: notices, **free-shipping progress bar** card, cart table card, an infobox carousel ("Have questions?" → contact, and more). Right: "Cart Totals" card (full-width button) + a card with "Payment methods:" (demo card-logos image), "Delivery information:" and "14 Days Money Back Guarantee:" (demo copy). Below: "You May Be Interested In…" carousel (5 per view). |
| **Checkout** | `/checkout/` | Active: "New Checkout top" (32218) + "New Checkout" (32211). Drafts: the "Checkout layout (form) Furniture 2" pair. | DEMO extras | Top (boxed 50%; 100% on mobile): notices, login form, coupon form, free-shipping bar (blue tint `#2E6BC60A`, 8 px radius). Form: row **58.3 / 41.7**, reversed on mobile (order summary first). Left: step "1." badge (`#363636`, Mulish) + "Billing Details" (20 px, 800), billing form, shipping form, then a grey box (`#F6F6F6`) with step "2." "Payment Information" and payment methods. Right: "Your Order" box (2 px `#EFEFEF` border, 25 px padding) with the order review and shipping bar; a **fake Trustpilot block** ("Excellent — Based on 1480 reviews", testimonial from "Albert Flores"), hidden on mobile; a "More Information" accordion (demo). **The Trustpilot block and testimonial are fabricated demo content and must not be shown.** |
| **Blog archive** | `/blog/` | Theme settings (page is empty) | DEMO posts | Rendered by WoodMart's blog archive settings, (not in export). On the homepage the posts used the *meta-image* card design. |
| **Single post** | `/<post-slug>/` (posts sit at the site root) | Each post's own Elementor content + theme single-post template | DEMO | Posts mix text blocks, 50/50 image + text rows, a "Torino showroom" block with brand logos, an inline product carousel and the "SØLREM" video pill. All demo. |
| **Portfolio** | `/portfolio/<slug>/` | Basel WPBakery content | DEMO | 3 demo projects ("Single Project", "Project Full Width", "Project with video"). The project categories (Mock-ups, Pictures, Print, Templates) are demo too. |
| **Showrooms** | `/showrooms/` | Elementor page 25 | **DEMO** (unfinished) | Two blocks, "Milano showroom" and "Torino showroom": a 66.6 / 33.4 row with brand logos and an address card (fake Italian addresses, `info@mail.com`, "(686) 492-1044") + a "Make a route" button, then a full-bleed 4-image carousel (3 per view on tablet, 1 on mobile). Demo SEO text at the end. |
| **Gift cards** | `/gift-cards/` | Elementor page 27 | **DEMO** (unfinished) | Two 50 / 50 banners ("e-Gift card" / "Gift card", 360 px, mask style, zoom on hover, subtitle "WOODMART") with "Buy now" buttons linking to products that don't exist, a WoodMart Gift Card paragraph (€ prices), and a lorem FAQ. |
| **Wishlist / Compare** | `/wishlist/`, `/compare/` | WoodMart widgets | SYSTEM | Single `wd_wishlist` / `wd_compare` widget. |
| **Tracking** | `/tracking/`, `/track-your-order/`, `/orders-tracking/` | plugin shortcodes | SYSTEM | Three overlapping tracking pages from different plugins; one is empty. |
| **Size guide** | (popup on product pages) | WoodMart size guide "Furniture size guidelines" + CMS block | DEMO | Image + 3 paragraphs about sofas. |
| **Promo popup** | (site-wide popup) | CMS block "Promo popup Furniture2" | DEMO | Image + "Hey You, Sign Up And Connect To Woodmart!" + Mailchimp email form. |
| **Refund and Returns Policy** | (draft, never published) | WooCommerce sample page | DEMO | "This is a sample page." |

---

## 6. Things to know (broken or unfinished data)

1. **No real catalogue.** All 12 products are demo items, a vendor test listing ("hoodie", no price) or the Dokan "Reverse Withdrawal Payment" system product. The demo items have lorem-ipsum descriptions and garbled names ("Eingerless gloves", "Jhecked flannel shirt"), filed under Wahbayaan categories, at prices like ₨10–₨485. The 37 categories are the only real catalogue data.
2. **Hard-coded staging links.** Slides and homepage widgets link to the old Bluehost staging address `lex.hgp.mybluehost.me/website_6d13e79b/…`, not `wahbayaan.com`.
3. **Dangling references.** The homepage points at 11 product IDs that aren't in the export (288, 297, 341, 371, 380, 421, 429, 432, 438, 481, 498). Three referenced image IDs are missing: 254 (used by the Curve and Grace products), 28202 (Black umbrella) and 127 (the cart layout's phone icon). Three "Main navigation" items point at a missing parent item (286).
4. **Footer errors.** "Salat Art & Decor"; links to `/product-category/furnitures`, `/antique-art/` and `/customized/`, none of which exist (the real slug is `customize`); "Become a seller" goes to `/my-account/` instead of the seller registration page.
5. **Two marketplace plugins** (WCFM and Dokan) and **three tracking pages** ran at the same time.
6. **Inconsistent Instagram handle:** `@wahbayaan.store` on the Contact page, `instagram.com/wahbayaan.shop` in the footer.
7. **Unfinished pages still published:** Showrooms and Gift cards (furniture demo, euro prices, fake addresses), the contact FAQ answers (placeholder text), checkout with a fake Trustpilot rating and testimonial, and the cart with "14 Days Money Back Guarantee" copy that was never confirmed.
8. **Currency switcher not wired** (links are `#`). The site priced in PKR (₨), and "PAK" showed an EU flag.
9. **Images:** none of the 276 attachments has alt text. Category images and many uploads were taken from Amazon, Pinterest, retailers, YouTube and news sites (see `images.md`). Most owner uploads are unused.
10. **Removed embed:** the homepage still caches an oEmbed for the YouTube video "Pakistan – It's not what I imagined!" (`LI7q30QbGnY`). The video was embedded once and later removed.
11. **Very small mobile subtitles** (8–10 px) on homepage section titles, and §9 / About columns that don't stack on phones.
12. **Theme settings missing:** header layout, global colours and fonts, the copyright text and the blog and shop defaults are not in a WordPress export. To get them, someone with admin access would export WoodMart → Theme Settings, or screenshot the old site from the Wayback Machine.

---

## 7. Old URLs (for 301 redirects)

Old permalink structure: pages at `/<slug>/`, posts at `/<post-slug>/`, products at `/product/<slug>/`, categories at `/product-category/<parent>/<child>/`, portfolio at `/portfolio/<slug>/`. "Suggested new path" uses the routes in this repo (`src/app/(store)`) and the category slugs in `scripts/seed-data.ts`. Every suggestion should be checked before it goes into Admin → Redirects. Demo URLs can redirect to the nearest real page or return 410.

| Type | Title | Old path | Status | Suggested new path |
|---|---|---|---|---|
| page | Home | / | REAL | / |
| page | Blog | /blog/ | SYSTEM | /journal |
| page | Wishlist | /wishlist/ | SYSTEM | /wishlist |
| page | Compare | /compare/ | SYSTEM | /compare |
| page | Showrooms | /showrooms/ | DEMO | / (demo page) |
| page | Gift cards | /gift-cards/ | DEMO | / (demo page) |
| page | Contact us | /contact-us/ | REAL | /contact |
| page | About us | /about-us/ | REAL | /about |
| page | Shop | /shop/ | SYSTEM | /shop |
| page | Cart | /cart/ | SYSTEM | /cart |
| page | Checkout | /checkout/ | SYSTEM | /checkout |
| page | My account | /my-account/ | SYSTEM | /account |
| page | Dashboard | /dashboard/ | REAL | /seller |
| page | Marketplace | /marketplace/ | SYSTEM | /artisans |
| page | My Orders | /my-orders/ | SYSTEM | /account/orders |
| page | Store Manager | /store-manager/ | SYSTEM | /seller |
| page | Seller Membership | /seller-membership/ | SYSTEM | /become-a-seller |
| page | Seller Registration | /seller-register/ | SYSTEM | /become-a-seller |
| page | Shipment Tracking | /tracking/ | SYSTEM | /track |
| page | Track Your Order | /track-your-order/ | SYSTEM | /track |
| page | Orders Tracking | /orders-tracking/ | SYSTEM | /track |
| product category | - | /product-category/accessories/ | DEMO | /shop |
| product category | Calligraphy Art | /product-category/calligraphy-art/ | REAL | /category/calligraphy-art |
| product category | Customize | /product-category/customize/ | REAL | /category/bespoke |
| product category | Handmade Carpets & Rugs | /product-category/handmade-carpets/ | REAL | /category/rugs |
| product category | Paintings | /product-category/paintings/ | REAL | /category/paintings |
| product category | Posters & Prints | /product-category/posters-prints/ | REAL | /category/posters-prints |
| product category | Salt Art & Decor | /product-category/salt-art-decor/ | REAL | /category/salt-art |
| product category | Stone sculptures [Taxila] | /product-category/stone-sculptures-taxila/ | REAL | /category/sculpture-stone |
| product category | Wall Decor & Accessories | /product-category/wall-decor-accessories/ | REAL | /category/wall-decor |
| product category | Islamic | /product-category/calligraphy-art/islamic/ | REAL | /category/calligraphy-art |
| product category | Modern/Abstract | /product-category/calligraphy-art/modern-abstract/ | REAL | /category/calligraphy-art |
| product category | Quranic Verses & Ayats | /product-category/calligraphy-art/quranic-verses-ayats/ | REAL | /category/calligraphy-art |
| product category | Urdu Poetry | /product-category/calligraphy-art/urdu-poetry/ | REAL | /category/calligraphy-art |
| product category | Abstract Modern Rugs | /product-category/handmade-carpets/abstract-modern-rugs/ | REAL | /category/rugs |
| product category | Custom Size Rugs | /product-category/handmade-carpets/custom-size-rugs/ | REAL | /category/rugs |
| product category | Kashmiri Handmade Carpets | /product-category/handmade-carpets/kashmiri-handmade-carpets/ | REAL | /category/rugs |
| product category | Persian Carpets | /product-category/handmade-carpets/persian-carpets/ | REAL | /category/rugs |
| product category | Prayer Mats | /product-category/handmade-carpets/prayer-mats/ | REAL | /category/rugs |
| product category | Tribal & Balochi Rugs | /product-category/handmade-carpets/tribal-balochi-rugs/ | REAL | /category/rugs |
| product category | Wool Carpets | /product-category/handmade-carpets/wool-carpets/ | REAL | /category/rugs |
| product category | Abstract | /product-category/paintings/abstract/ | REAL | /category/paintings |
| product category | Cultural & Traditional | /product-category/paintings/cultural-traditional/ | REAL | /category/paintings |
| product category | Figurative & Potraits | /product-category/paintings/figurative-potraits/ | REAL | /category/paintings |
| product category | Islamic & Sufi Art | /product-category/paintings/islamic-sufi-art/ | REAL | /category/paintings |
| product category | Miniature Art | /product-category/paintings/miniature-art/ | REAL | /category/paintings |
| product category | Nature & Landscapes | /product-category/paintings/nature-landscapes/ | REAL | /category/paintings |
| product category | Cultural | /product-category/posters-prints/cultural/ | REAL | /category/posters-prints |
| product category | Famous Personalities | /product-category/posters-prints/famous-personalities/ | REAL | /category/posters-prints |
| product category | Motivational Quotes | /product-category/posters-prints/motivational-quotes/ | REAL | /category/posters-prints |
| product category | Pop Art | /product-category/posters-prints/pop-art/ | REAL | /category/posters-prints |
| product category | Vintage | /product-category/posters-prints/vintage/ | REAL | /category/posters-prints |
| product category | Islamic Wall Clocks | /product-category/wall-decor-accessories/islamic-wall-clocks/ | REAL | /category/wall-decor |
| product category | Metal Art Pieces | /product-category/wall-decor-accessories/metal-art-pieces/ | REAL | /category/wall-decor |
| product category | Mirrors | /product-category/wall-decor-accessories/mirrors/ | REAL | /category/wall-decor |
| product category | Tapestry/Wall Fabric | /product-category/wall-decor-accessories/tapestry-wall-fabric/ | REAL | /category/wall-decor |
| product category | Wall Plates | /product-category/wall-decor-accessories/wall-plates/ | REAL | /category/wall-decor |
| product category | Wooden Wall Hangings | /product-category/wall-decor-accessories/wooden-wall-hangings/ | REAL | /category/wall-decor |
| product | Variable product example | /product/variable-product-example/ | DEMO | /shop (410 Gone is also fine) |
| product | Basic contrast sneakers | /product/basic-contrast-sneakers/ | DEMO | /shop (410 Gone is also fine) |
| product | Basic Korean-style coat | /product/basic-korean-style-coat/ | DEMO | /shop (410 Gone is also fine) |
| product | Black umbrella in handle | /product/black-umbrella-in-handle/ | DEMO | /shop (410 Gone is also fine) |
| product | Bold metallic watch | /product/bold-metallic-watch/ | DEMO | /shop (410 Gone is also fine) |
| product | Eingerless gloves in camel | /product/eingerless-gloves-in-camel/ | DEMO | /shop (410 Gone is also fine) |
| product | Gthnic detail open jacket | /product/gthnic-detail-open-jacket/ | DEMO | /shop (410 Gone is also fine) |
| product | Jhecked flannel shirt | /product/jhecked-flannel-shirt/ | DEMO | /shop (410 Gone is also fine) |
| product | Curve | /product/curve/ | DEMO | /shop (410 Gone is also fine) |
| product | Grace | /product/grace/ | DEMO | /shop (410 Gone is also fine) |
| product | Reverse Withdrawal Payment | /product/reverse-withdrawal-payment/ | DEMO | /shop (410 Gone is also fine) |
| product | hoodie | /product/hoodie/ | DEMO | /shop (410 Gone is also fine) |
| blog post | Here comes autumn | /here-comes-autumn/ | DEMO | /journal |
| blog post | Flowing serpentines | /flowing-serpentines/ | DEMO | /journal |
| blog post | The clean series | /the-clean-series/ | DEMO | /journal |
| blog post | For clear thinking | /for-clear-thinking/ | DEMO | /journal |
| blog post | Ethimo mountain style | /ethimo-mountain-style/ | DEMO | /journal |
| blog post | In the heart of Valencia | /in-the-heart-of-valencia/ | DEMO | /journal |
| portfolio | A fusce fringilla scelerisque | /portfolio/a-fusce-fringilla-scelerisque/ | DEMO | / |
| portfolio | Lectus aptent facilisis habitasse | /portfolio/lectus-aptent-facilisis-habitasse/ | DEMO | / |
| portfolio | Varius tempor arcu sociosqu | /portfolio/varius-tempor-arcu-sociosqu/ | DEMO | / |
| blog category | Decoration | /category/decoration/ | DEMO | /journal |
| blog category | Design trends | /category/design-trends/ | DEMO | /journal |
| blog category | Fashion | /category/fashion/ | DEMO | /journal |
| blog category | Furniture | /category/furniture/ | DEMO | /journal |
| blog category | Inspiration | /category/inspiration/ | DEMO | /journal |
| blog category | Lifestyle | /category/lifestyle/ | DEMO | /journal |
| blog category | Travel | /category/travel/ | DEMO | /journal |
| blog category | Uncategorized | /category/uncategorized/ | DEMO | /journal |
| blog category | Wooden accessories | /category/wooden-accessories/ | DEMO | /journal |
| blog tag | bathroom | /tag/bathroom/ | DEMO | /journal |
| blog tag | chair | /tag/chair/ | DEMO | /journal |
| blog tag | furniture | /tag/furniture/ | DEMO | /journal |
| blog tag | guide | /tag/guide/ | DEMO | /journal |
| blog tag | inspiration | /tag/inspiration/ | DEMO | /journal |
| blog tag | machine | /tag/machine/ | DEMO | /journal |
| blog tag | sofa | /tag/sofa/ | DEMO | /journal |
| blog tag | style | /tag/style/ | DEMO | /journal |
| blog tag | trends | /tag/trends/ | DEMO | /journal |
| product brand | 4Mariani | /brand/4mariani/ (WooCommerce brand base; confirm) | DEMO | /shop |
| product brand | Bitte | /brand/bitte/ (WooCommerce brand base; confirm) | DEMO | /shop |
| product brand | Elitis | /brand/elitis/ (WooCommerce brand base; confirm) | DEMO | /shop |
| product brand | Enza Home | /brand/enza-home/ (WooCommerce brand base; confirm) | DEMO | /shop |
| product brand | Flos | /brand/flos/ (WooCommerce brand base; confirm) | DEMO | /shop |
| product brand | Gan | /brand/gan/ (WooCommerce brand base; confirm) | DEMO | /shop |
| product brand | Hay | /brand/hay/ (WooCommerce brand base; confirm) | DEMO | /shop |
| product brand | Kettal | /brand/kettal/ (WooCommerce brand base; confirm) | DEMO | /shop |
| product brand | Lladro | /brand/lladro/ (WooCommerce brand base; confirm) | DEMO | /shop |
| product brand | Minotti | /brand/minotti/ (WooCommerce brand base; confirm) | DEMO | /shop |
| footer link (broken) | Furnitures | /product-category/furnitures | BROKEN (no such category) | /category/furniture |
| footer link (broken) | Antique Art | /product-category/antique-art/ | BROKEN (no such category) | /shop |
| footer link (broken) | Customized | /product-category/customized/ | BROKEN (category slug is customize) | /category/bespoke |
| vendor stores | WCFM store pages | /store/<store-slug>/ (WCFM default base; slugs not in export) | REAL (dynamic) | /artisans/<slug> |
| feeds/system | RSS, author archives, search | /feed/, /author/<login>/, /?s= | SYSTEM | /journal, /artisans, /search |

The slider, homepage and page links on the old site often used the staging host `lex.hgp.mybluehost.me/website_6d13e79b/…`. Nobody outside the old host should have that address, so it needs no redirect, but any copied link must be rewritten.
