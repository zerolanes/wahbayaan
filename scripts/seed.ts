/**
 * npm run db:seed            → base data (+ demo data when DEMO_MODE=true)
 * npm run db:seed -- --demo  → force demo data
 *
 * Idempotent for base data; demo data is only inserted into an empty catalogue.
 */
import "./env";
import { eq, sql } from "drizzle-orm";
import { closeDb, getDb, type Db } from "../src/lib/db/connect";
import * as t from "../src/lib/db/schema";
import { hashPassword } from "../src/lib/auth/password";
import { ROLE_PRESETS } from "../src/lib/auth/permissions";
import { DESTINATIONS } from "../src/lib/money/currency";
import { CATEGORIES, DEMO_JOURNAL, DEMO_PRODUCTS, DEMO_VENDORS, FAQS, POLICY_PAGES } from "./seed-data";
import { seedBrandsBase, seedBrandsDemo } from "./seed-brands";

const DEMO_PASSWORD = "wahbayaan-demo";
const art = (kind: string, seed: number, size?: string) => `/art/${kind}/${seed}${size ? `-${size}` : ""}.svg`;
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

export async function seedBase(db: Db) {
  // Staff roles
  for (const role of ROLE_PRESETS) {
    await db
      .insert(t.staffRoles)
      .values({ name: role.name, description: role.description, permissions: role.permissions, isSystem: role.name === "Owner" })
      .onConflictDoUpdate({ target: t.staffRoles.name, set: { permissions: role.permissions, description: role.description } });
  }

  // Category taxonomy. Covers start as brand illustrations; the launch-readiness
  // check asks for real photography before launch.
  for (const [i, c] of CATEGORIES.entries()) {
    await db
      .insert(t.categories)
      .values({
        slug: c.slug,
        name: c.name,
        tagline: c.tagline,
        description: c.description,
        coverImageUrl: art(c.art, c.seed, "wide"),
        coverKind: "illustration",
        sort: i,
      })
      .onConflictDoNothing({ target: t.categories.slug });
  }

  // Rate tables: rows exist so the admin can fill them in, but every rate is pending.
  const [{ n: shipCount }] = await db.select({ n: sql<number>`count(*)::int` }).from(t.shippingRates);
  if (!shipCount) {
    const bands = [
      [0, 2000],
      [2001, 5000],
      [5001, 10000],
      [10001, 20000],
      [20001, 70000],
    ];
    for (const d of DESTINATIONS)
      for (const courier of ["DHL Express", "FedEx International Priority", "Aramex"])
        for (const [min, max] of bands)
          await db.insert(t.shippingRates).values({
            courier,
            destinationCountry: d.code,
            minWeightG: min,
            maxWeightG: max,
            amount: null,
            currency: "PKR",
            status: "pending",
            notes: "Pending courier contract — enter the contracted rate and activate.",
          });
  }

  const [{ n: dutyCount }] = await db.select({ n: sql<number>`count(*)::int` }).from(t.dutyRates);
  if (!dutyCount) {
    const cats = await db.select().from(t.categories);
    for (const d of DESTINATIONS)
      for (const c of cats)
        await db.insert(t.dutyRates).values({
          destinationCountry: d.code,
          categoryId: c.id,
          status: "pending",
          basis: "item_plus_shipping",
          notes: "Pending — confirm HS code and duty/tax rates with a customs broker.",
        });
  }

  const [{ n: faqCount }] = await db.select({ n: sql<number>`count(*)::int` }).from(t.faqs);
  if (!faqCount) for (const [i, q] of FAQS.entries()) await db.insert(t.faqs).values({ ...q, sort: i });

  for (const p of POLICY_PAGES) await db.insert(t.pages).values(p).onConflictDoNothing({ target: t.pages.slug });

  await seedBrandsBase(db);

  // Owner account from the environment (production bootstrap).
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const owner = await db.query.staffRoles.findFirst({ where: eq(t.staffRoles.name, "Owner") });
    await db
      .insert(t.users)
      .values({
        email: process.env.ADMIN_EMAIL,
        name: process.env.ADMIN_NAME ?? "Owner",
        passwordHash: await hashPassword(process.env.ADMIN_PASSWORD),
        role: "staff",
        staffRoleId: owner!.id,
      })
      .onConflictDoNothing();
  }
}

type CatLookup = (slug: string) => string;

/** One demo artisan: login, verified vendor profile and passed checks. */
async function insertDemoVendor(db: Db, v: (typeof DEMO_VENDORS)[number], i: number, pw: string, catId: CatLookup, checkerId: string) {
  const [u] = await db
    .insert(t.users)
    .values({ email: `${v.slug}@artisans.wahbayaan.test`, name: v.displayName, passwordHash: pw, role: "seller", country: "PK", isDemo: true })
    .returning();
  const [vendor] = await db
    .insert(t.vendors)
    .values({
      userId: u.id,
      slug: v.slug,
      displayName: v.displayName,
      craft: v.craft,
      primaryCategoryId: catId(v.category),
      tagline: v.tagline,
      story: v.story,
      craftHistory: v.craftHistory,
      workshopCity: v.city,
      workshopRegion: v.region,
      foundedYear: v.foundedYear,
      languages: v.languages,
      profilePhotoUrl: art("avatar", 100 + i, "avatar"),
      profilePhotoKind: "illustration",
      bannerUrl: art("banner", 200 + i, "banner"),
      status: "verified",
      verifiedAt: daysAgo(200 - i * 10),
      locationVerified: true,
      responseTimeHours: v.responseTimeHours,
      isFeatured: !!v.featured,
      payoutMethod: "bank",
      payoutAccountTitle: v.displayName,
      payoutBankName: "Demo Bank",
      payoutAccountLast4: String(1000 + i * 37).slice(-4),
      isDemo: true,
    })
    .returning();
  for (const kind of ["identity", "workshop", "samples", "video_call"] as const)
    await db.insert(t.verificationChecks).values({
      vendorId: vendor.id,
      kind,
      status: "passed",
      notes: "Demo verification",
      checkedById: checkerId,
      checkedAt: daysAgo(200 - i * 10),
    });
  return vendor.id;
}

/** One demo listing with its illustrated images. */
async function insertDemoProduct(db: Db, p: (typeof DEMO_PRODUCTS)[number], i: number, vendorId: string, catId: CatLookup) {
  const vendorSeed = DEMO_VENDORS.find((v) => v.slug === p.vendor)!;
  const [row] = await db
    .insert(t.products)
    .values({
      vendorId,
      categoryId: catId(p.category),
      slug: slugify(p.title.replace(/[“”—]/g, " ")),
      title: p.title,
      summary: p.summary,
      description: p.description,
      story: p.story,
      pricePkr: p.pricePkr * 100,
      compareAtPricePkr: p.compareAtPricePkr ? p.compareAtPricePkr * 100 : null,
      status: "active",
      availability: p.availability,
      stockQty: p.stockQty ?? 1,
      isOneOfAKind: !!p.oneOfAKind,
      timeToMakeDays: p.timeToMakeDays ?? null,
      dispatchDays: p.dispatchDays ?? null,
      widthCm: String(p.dims[0]),
      heightCm: String(p.dims[1]),
      depthCm: String(p.dims[2]),
      weightG: p.weightG,
      materials: p.materials,
      techniques: p.techniques ?? [],
      careInstructions: p.care,
      region: vendorSeed.region,
      customizable: !!p.customization?.length,
      customizationOptions: p.customization ?? [],
      model3d: { source: "procedural", kind: p.art, seed: p.seeds[0] },
      isFeatured: !!p.featured,
      isLimitedDrop: !!p.limitedDrop,
      dropStartsAt: p.limitedDrop ? daysFromNow(p.limitedDrop.startsInDays) : null,
      editionSize: p.limitedDrop?.editionSize ?? null,
      wholesaleEnabled: !!p.wholesale,
      wholesaleMinQty: p.wholesale?.minQty ?? null,
      wholesalePricePkr: p.wholesale ? p.wholesale.pricePkr * 100 : null,
      viewCount: 40 + ((i * 53) % 400),
      publishedAt: daysAgo(90 - i * 2),
      isDemo: true,
    })
    .returning();
  await db.insert(t.productImages).values(
    p.seeds.map((seed, sort) => ({
      productId: row.id,
      url: art(p.art, seed),
      alt: `${p.title} — illustration ${sort + 1}`,
      kind: "illustration" as const,
      sort,
    })),
  );
  return row;
}

/**
 * For an existing demo catalogue: add demo artisans and listings that were
 * added to seed-data after the database was first seeded (matched by slug),
 * and a first announcement. Never touches existing rows, orders or users.
 */
async function topUpDemo(db: Db) {
  const cats = await db.select().from(t.categories);
  const catId = (slug: string) => cats.find((c) => c.slug === slug)!.id;
  const [ownerUser] = await db.select().from(t.users).where(eq(t.users.email, "admin@wahbayaan.test"));
  if (!ownerUser) return;
  const pw = await hashPassword(DEMO_PASSWORD);
  const vendorRows = await db.select({ id: t.vendors.id, slug: t.vendors.slug }).from(t.vendors);
  const vendorIds = new Map(vendorRows.map((v) => [v.slug, v.id]));
  let addedVendors = 0;
  for (const [i, v] of DEMO_VENDORS.entries()) {
    if (vendorIds.has(v.slug)) continue;
    vendorIds.set(v.slug, await insertDemoVendor(db, v, i, pw, catId, ownerUser.id));
    addedVendors++;
  }
  const slugs = new Set((await db.select({ slug: t.products.slug }).from(t.products)).map((r) => r.slug));
  let addedProducts = 0;
  for (const [i, p] of DEMO_PRODUCTS.entries()) {
    if (slugs.has(slugify(p.title.replace(/[“”—]/g, " ")))) continue;
    const vendorId = vendorIds.get(p.vendor);
    if (!vendorId) continue;
    await insertDemoProduct(db, p, i, vendorId, catId);
    addedProducts++;
  }
  const [{ n: announcementCount }] = await db.select({ n: sql<number>`count(*)::int` }).from(t.announcements);
  if (!announcementCount) await db.insert(t.announcements).values(DEMO_ANNOUNCEMENT);
  const usBuyer = await db.query.users.findFirst({ where: eq(t.users.email, "buyer@wahbayaan.test") });
  if (usBuyer) await seedBrandsDemo(db, { ownerId: ownerUser.id, usBuyerId: usBuyer.id, passwordHash: pw });
  console.log(`Demo top-up: ${addedVendors} new artisans, ${addedProducts} new listings.`);
}

const DEMO_ANNOUNCEMENT = {
  message: "New: carved Chiniot furniture and full-size snooker tables — made to order, delivered by freight",
  link: "/category/furniture",
  isActive: true,
};

export async function seedDemo(db: Db) {
  const [{ n: existing }] = await db.select({ n: sql<number>`count(*)::int` }).from(t.products);
  if (existing) {
    console.log("Catalogue already has products — topping up new demo rows only.");
    await topUpDemo(db);
    return;
  }
  const pw = await hashPassword(DEMO_PASSWORD);
  const roles = await db.select().from(t.staffRoles);
  const roleId = (name: string) => roles.find((r) => r.name === name)!.id;
  const cats = await db.select().from(t.categories);
  const catId = (slug: string) => cats.find((c) => c.slug === slug)!.id;

  // Placeholder exchange rates — clearly labelled; replace in Admin → Rates.
  for (const [currency, rate] of [
    ["USD", "280"],
    ["GBP", "375"],
    ["CAD", "205"],
  ] as const) {
    await db
      .insert(t.fxRates)
      .values({ currency, pkrPerUnit: rate, source: "Placeholder (demo) — set real rates in Admin → Rates", status: "placeholder" })
      .onConflictDoNothing();
  }

  // Staff
  const staff = [
    { email: "admin@wahbayaan.test", name: "Demo Owner", role: "Owner" },
    { email: "ops@wahbayaan.test", name: "Demo Operations", role: "Operations" },
    { email: "finance@wahbayaan.test", name: "Demo Finance", role: "Finance" },
    { email: "artisans@wahbayaan.test", name: "Demo Artisan Relations", role: "Artisan relations" },
  ];
  for (const s of staff)
    await db.insert(t.users).values({ email: s.email, name: s.name, passwordHash: pw, role: "staff", staffRoleId: roleId(s.role), isDemo: true });
  const [ownerUser] = await db.select().from(t.users).where(eq(t.users.email, "admin@wahbayaan.test"));

  // Buyers
  const buyers = [
    { email: "buyer@wahbayaan.test", name: "Demo Buyer (US)", country: "US" },
    { email: "buyer.uk@wahbayaan.test", name: "Demo Buyer (UK)", country: "GB" },
    { email: "buyer.ca@wahbayaan.test", name: "Demo Buyer (Canada)", country: "CA" },
    { email: "designer@wahbayaan.test", name: "Demo Interior Studio", country: "US", wholesale: true },
  ];
  const buyerRows = [];
  for (const b of buyers) {
    const [u] = await db
      .insert(t.users)
      .values({ email: b.email, name: b.name, passwordHash: pw, role: "buyer", country: b.country, isWholesale: !!b.wholesale, isDemo: true })
      .returning();
    buyerRows.push(u);
  }
  const [usBuyer, ukBuyer, caBuyer] = buyerRows;
  await db.insert(t.addresses).values([
    {
      userId: usBuyer.id,
      label: "Home",
      fullName: "Demo Buyer",
      line1: "100 Example Street",
      city: "Springfield",
      region: "IL",
      postalCode: "62701",
      country: "US",
      isDefault: true,
    },
    {
      userId: ukBuyer.id,
      label: "Home",
      fullName: "Demo Buyer",
      line1: "1 Example Road",
      city: "Manchester",
      postalCode: "M1 1AA",
      country: "GB",
      isDefault: true,
    },
    {
      userId: caBuyer.id,
      label: "Home",
      fullName: "Demo Buyer",
      line1: "1 Example Avenue",
      city: "Toronto",
      region: "ON",
      postalCode: "M5V 1A1",
      country: "CA",
      isDefault: true,
    },
  ]);
  await db.insert(t.referralCodes).values({ code: "DEMO-FRIEND", userId: usBuyer.id });

  // Artisans
  const vendorIds = new Map<string, string>();
  for (const [i, v] of DEMO_VENDORS.entries()) vendorIds.set(v.slug, await insertDemoVendor(db, v, i, pw, catId, ownerUser.id));

  // Two unfinished stores that reproduce the old site's problem (shared template
  // banner, no photo, no story). The visibility guards keep them off the storefront
  // and the launch-readiness check lists them.
  for (const [i, name] of ["Unfinished Store One", "Unfinished Store Two"].entries()) {
    const [u] = await db
      .insert(t.users)
      .values({ email: `unfinished${i + 1}@artisans.wahbayaan.test`, name, passwordHash: pw, role: "seller", country: "PK", isDemo: true })
      .returning();
    await db.insert(t.vendors).values({
      userId: u.id,
      slug: slugify(name),
      displayName: name,
      craft: "Unspecified",
      bannerUrl: "/art/banner/1-banner.svg",
      status: "verified",
      isDemo: true,
    });
  }

  // Pending applications
  await db.insert(t.vendorApplications).values([
    {
      fullName: "Demo Applicant — Kashmiri papier-mâché",
      email: "applicant1@example.test",
      phone: "+92 300 0000001",
      craft: "Papier-mâché",
      categoryId: catId("wall-decor"),
      workshopCity: "Muzaffarabad",
      workshopRegion: "azad_kashmir",
      yearsPracticing: 14,
      story: "Family workshop painting papier-mâché boxes and ornaments.",
      samplePhotoUrls: [art("tile", 301), art("pottery", 302)],
      status: "submitted",
    },
    {
      fullName: "Demo Applicant — Balochi embroidery",
      email: "applicant2@example.test",
      craft: "Balochi embroidery",
      categoryId: catId("wall-decor"),
      workshopCity: "Quetta",
      workshopRegion: "balochistan",
      yearsPracticing: 9,
      story: "A women's collective stitching mirror-work panels.",
      samplePhotoUrls: [art("ajrak", 303)],
      status: "in_review",
      exportedBefore: false,
    },
    {
      fullName: "Demo Applicant — onyx carving",
      email: "applicant3@example.test",
      craft: "Onyx carving",
      categoryId: catId("sculpture-stone"),
      workshopCity: "Karachi",
      workshopRegion: "sindh",
      yearsPracticing: 20,
      samplePhotoUrls: [art("stone", 304)],
      status: "more_info",
      reviewerNotes: "Asked for a short workshop video.",
    },
  ]);

  // Products
  const productIds = new Map<string, string>();
  const productRows: (typeof t.products.$inferSelect)[] = [];
  for (const [i, p] of DEMO_PRODUCTS.entries()) {
    const row = await insertDemoProduct(db, p, i, vendorIds.get(p.vendor)!, catId);
    productIds.set(p.title, row.id);
    productRows.push(row);
  }

  // A pending listing and a draft, so moderation queues aren't empty.
  await db.insert(t.products).values([
    {
      vendorId: vendorIds.get("multan-blue-kiln")!,
      categoryId: catId("wall-decor"),
      slug: "blue-pottery-lamp-base-pending",
      title: "Blue pottery lamp base",
      summary: "Awaiting review.",
      description: "A lamp base painted in the Multani style.",
      pricePkr: 19_500_00,
      status: "pending_review",
      weightG: 2400,
      materials: ["earthenware"],
      isDemo: true,
    },
    {
      vendorId: vendorIds.get("khewra-salt-studio")!,
      categoryId: catId("salt-art"),
      slug: "salt-cooking-slab-draft",
      title: "Salt cooking slab",
      status: "draft",
      pricePkr: 6_500_00,
      materials: ["Himalayan salt"],
      isDemo: true,
    },
  ]);

  // Sample reviews (clearly labelled as samples in the UI via is_demo).
  const reviewBodies = [
    ["Worth every week of the wait", "Arrived double-boxed with a handwritten note. The photos don't do the colour justice."],
    ["Beautiful and exactly as described", "Dimensions were spot on and the artisan answered every question within a day."],
    ["A gift that made my mother cry", "Ordered for her birthday and shipped straight to her. She has it in the living room."],
    ["Stunning craftsmanship", "You can see the hand in every detail. Duties were what the estimate said."],
    ["Good, but slow to ship", "Lovely piece, but dispatch took a few days longer than listed."],
  ];
  const countries = ["US", "GB", "CA"];
  let reviewCount = 0;
  for (const [i, row] of productRows.entries()) {
    const n = i % 4 === 3 ? 0 : 1 + (i % 3);
    for (let k = 0; k < n; k++) {
      const [title, body] = reviewBodies[(i + k) % reviewBodies.length];
      const rating = (i + k) % reviewBodies.length === 4 ? 4 : 5;
      const [rev] = await db
        .insert(t.reviews)
        .values({
          productId: row.id,
          vendorId: row.vendorId,
          userId: buyerRows[(i + k) % 3].id,
          authorName: "Sample review",
          buyerCountry: countries[(i + k) % 3],
          rating,
          title,
          body,
          status: "published",
          sellerReply: k === 0 && i % 2 === 0 ? "Thank you — it was a pleasure to make this for you." : null,
          sellerRepliedAt: k === 0 && i % 2 === 0 ? daysAgo(10) : null,
          createdAt: daysAgo(60 - i - k),
          isDemo: true,
        })
        .returning();
      reviewCount++;
      if ((i + k) % 3 === 0) {
        const kind = DEMO_PRODUCTS[i].art;
        await db.insert(t.reviewPhotos).values([{ reviewId: rev.id, url: art(kind, 500 + i * 3 + k, "square") }]);
      }
    }
  }
  // One review awaiting moderation.
  await db.insert(t.reviews).values({
    productId: productRows[0].id,
    vendorId: productRows[0].vendorId,
    userId: caBuyer.id,
    authorName: "Sample review",
    buyerCountry: "CA",
    rating: 3,
    title: "Frame arrived scratched",
    body: "The calligraphy is gorgeous but the frame corner was scratched in transit.",
    status: "pending",
    isDemo: true,
  });

  // Orders across the lifecycle.
  const fxUSD = "280";
  type Spec = {
    buyer: typeof usBuyer;
    currency: "USD" | "GBP" | "CAD";
    fx: string;
    status: (typeof t.orderStatus.enumValues)[number];
    vendorStatus: (typeof t.vendorOrderStatus.enumValues)[number];
    products: string[];
    shipping?: number;
    duty?: number;
    tax?: number;
    daysAgo: number;
    tracking?: boolean;
    funds: (typeof t.fundsState.enumValues)[number];
    paid: boolean;
    gift?: boolean;
  };
  const specs: Spec[] = [
    {
      buyer: usBuyer,
      currency: "USD",
      fx: fxUSD,
      status: "completed",
      vendorStatus: "delivered",
      products: ["Madder-red Bukhara, 6×9 ft"],
      shipping: 185_00,
      duty: 0,
      tax: 0,
      daysAgo: 70,
      tracking: true,
      funds: "released",
      paid: true,
    },
    {
      buyer: ukBuyer,
      currency: "GBP",
      fx: "375",
      status: "delivered",
      vendorStatus: "delivered",
      products: ["Multani blue charger plate, 45 cm", "Blue pottery bowl"],
      shipping: 64_00,
      duty: 0,
      tax: 38_00,
      daysAgo: 21,
      tracking: true,
      funds: "held",
      paid: true,
    },
    {
      buyer: caBuyer,
      currency: "CAD",
      fx: "205",
      status: "shipped",
      vendorStatus: "shipped",
      products: ["Stupa niche relief in grey schist"],
      shipping: 240_00,
      duty: 0,
      tax: 70_00,
      daysAgo: 9,
      tracking: true,
      funds: "held",
      paid: true,
    },
    {
      buyer: usBuyer,
      currency: "USD",
      fx: fxUSD,
      status: "in_fulfilment",
      vendorStatus: "in_production",
      products: ["Your name in Nastaliq — commissioned panel"],
      shipping: 60_00,
      duty: 0,
      tax: 0,
      daysAgo: 5,
      funds: "held",
      paid: true,
      gift: true,
    },
    {
      buyer: usBuyer,
      currency: "USD",
      fx: fxUSD,
      status: "paid",
      vendorStatus: "pending",
      products: ["Phool — truck-art panel on wood", "Badshahi skyline — screen print"],
      shipping: 72_00,
      duty: 0,
      tax: 0,
      daysAgo: 1,
      funds: "held",
      paid: true,
    },
    {
      buyer: ukBuyer,
      currency: "GBP",
      fx: "375",
      status: "awaiting_quote",
      vendorStatus: "pending",
      products: ["Carved jharokha panel in sheesham"],
      daysAgo: 0,
      funds: "none",
      paid: false,
    },
    {
      buyer: caBuyer,
      currency: "CAD",
      fx: "205",
      status: "disputed",
      vendorStatus: "delivered",
      products: ["Hand-shaped salt lamp on sheesham base, large"],
      shipping: 58_00,
      duty: 0,
      tax: 9_00,
      daysAgo: 30,
      tracking: true,
      funds: "frozen",
      paid: true,
    },
    {
      buyer: usBuyer,
      currency: "USD",
      fx: fxUSD,
      status: "cancelled",
      vendorStatus: "cancelled",
      products: ["Tall floral vase"],
      daysAgo: 40,
      funds: "none",
      paid: false,
    },
  ];

  let orderSeq = 1000;
  const certificateItems: { itemId: string; productTitle: string; vendorSlug: string; createdAt: Date }[] = [];
  for (const spec of specs) {
    orderSeq++;
    const created = daysAgo(spec.daysAgo);
    const items = spec.products.map((title) => {
      const p = DEMO_PRODUCTS.find((x) => x.title === title)!;
      return { p, id: productIds.get(title)!, unitPricePkr: p.pricePkr * 100, unitPrice: Math.round((p.pricePkr * 100) / Number(spec.fx)) };
    });
    const itemsSubtotal = items.reduce((a, i) => a + i.unitPrice, 0);
    const quoted = spec.shipping != null;
    const total = itemsSubtotal + (spec.shipping ?? 0) + (spec.duty ?? 0) + (spec.tax ?? 0);
    const addr = await db.query.addresses.findFirst({ where: eq(t.addresses.userId, spec.buyer.id) });
    const [order] = await db
      .insert(t.orders)
      .values({
        number: `WB-${orderSeq}`,
        userId: spec.buyer.id,
        email: spec.buyer.email,
        customerName: spec.buyer.name,
        currency: spec.currency,
        fxPkrPerUnit: spec.fx,
        fxSource: "Placeholder (demo)",
        destinationCountry: spec.buyer.country!,
        shippingAddress: {
          fullName: addr!.fullName,
          line1: addr!.line1,
          city: addr!.city,
          region: addr!.region,
          postalCode: addr!.postalCode,
          country: addr!.country,
        },
        status: spec.status,
        paymentStatus: spec.paid ? "paid" : "unpaid",
        fundsState: spec.funds,
        itemsSubtotal,
        shippingAmount: spec.shipping ?? null,
        shippingStatus: quoted ? "known" : "pending",
        dutyAmount: spec.duty ?? null,
        dutyStatus: quoted ? "known" : "pending",
        importTaxAmount: spec.tax ?? null,
        importTaxStatus: quoted ? (spec.tax ? "known" : "not_applicable") : "pending",
        handlingStatus: "pending",
        total,
        totalComplete: quoted,
        isGift: !!spec.gift,
        giftMessage: spec.gift ? "Happy birthday — with love from all of us." : null,
        quoteSentAt: quoted ? created : null,
        paidAt: spec.paid ? created : null,
        deliveredAt: ["delivered", "completed", "disputed"].includes(spec.status) ? daysAgo(Math.max(spec.daysAgo - 12, 1)) : null,
        autoReleaseAt: spec.status === "delivered" ? daysFromNow(4) : null,
        releasedAt: spec.funds === "released" ? daysAgo(spec.daysAgo - 20) : null,
        cancelledAt: spec.status === "cancelled" ? daysAgo(spec.daysAgo - 1) : null,
        createdAt: created,
        isDemo: true,
      })
      .returning();

    const byVendor = new Map<string, typeof items>();
    for (const it of items) {
      const vid = vendorIds.get(it.p.vendor)!;
      byVendor.set(vid, [...(byVendor.get(vid) ?? []), it]);
    }
    for (const [vendorId, vItems] of byVendor) {
      const subtotalPkr = vItems.reduce((a, i) => a + i.unitPricePkr, 0);
      const [vo] = await db
        .insert(t.vendorOrders)
        .values({
          orderId: order.id,
          vendorId,
          status: spec.vendorStatus,
          subtotalPkr,
          courier: spec.tracking ? "DHL Express" : null,
          trackingNumber: spec.tracking ? `DEMO${orderSeq}${vendorId.slice(0, 4).toUpperCase()}` : null,
          shippedAt: spec.tracking ? daysAgo(Math.max(spec.daysAgo - 3, 1)) : null,
          deliveredAt: ["delivered"].includes(spec.vendorStatus) ? daysAgo(Math.max(spec.daysAgo - 12, 1)) : null,
          createdAt: created,
        })
        .returning();
      for (const it of vItems) {
        const [oi] = await db
          .insert(t.orderItems)
          .values({
            orderId: order.id,
            vendorOrderId: vo.id,
            productId: it.id,
            vendorId,
            title: it.p.title,
            imageUrl: art(it.p.art, it.p.seeds[0]),
            qty: 1,
            unitPricePkr: it.unitPricePkr,
            unitPrice: it.unitPrice,
            customization: it.p.customization ? { text: "The Demo Family", ink: "Gold leaf", ground: "Indigo" } : {},
          })
          .returning();
        if (it.p.oneOfAKind && spec.paid && spec.status !== "cancelled")
          certificateItems.push({ itemId: oi.id, productTitle: it.p.title, vendorSlug: it.p.vendor, createdAt: created });
      }
    }

    const events: [string, string, number][] = [["placed", "Order placed", 0]];
    if (spec.status === "awaiting_quote") events.push(["awaiting_quote", "Our team is preparing an exact shipping and duty quote", 0]);
    if (quoted) events.push(["quote", "Shipping and duty confirmed", 0]);
    if (spec.paid) events.push(["paid", "Payment received — funds held by Wahbayaan until delivery", 0]);
    if (spec.tracking) events.push(["shipped", "Shipped with DHL Express", 3]);
    if (["delivered", "completed", "disputed"].includes(spec.status)) events.push(["delivered", "Delivered", 12]);
    if (spec.status === "completed") events.push(["released", "Buyer confirmed delivery — funds released to the artisan", 14]);
    if (spec.status === "disputed") events.push(["dispute", "Buyer opened a case: damaged in transit", 13]);
    if (spec.status === "cancelled") events.push(["cancelled", "Cancelled by buyer before payment", 1]);
    for (const [kind, message, offset] of events)
      await db.insert(t.orderEvents).values({ orderId: order.id, kind, message, createdAt: new Date(created.getTime() + offset * 86_400_000) });

    if (spec.paid)
      await db.insert(t.payments).values({
        orderId: order.id,
        provider: "test",
        providerRef: `test_${orderSeq}`,
        amount: total,
        currency: spec.currency,
        status: "succeeded",
        mode: "test",
        createdAt: created,
      });

    if (spec.status === "disputed") {
      const [dispute] = await db
        .insert(t.disputes)
        .values({
          number: `CASE-${orderSeq}`,
          orderId: order.id,
          userId: spec.buyer.id,
          reason: "damaged",
          description: "The lamp arrived with a large chip and the base was cracked.",
          desiredOutcome: "replacement",
          evidenceUrls: [art("salt", 901, "square")],
          status: "awaiting_seller",
          createdAt: daysAgo(spec.daysAgo - 13),
        })
        .returning();
      await db.insert(t.disputeMessages).values([
        {
          disputeId: dispute.id,
          authorRole: "buyer",
          authorUserId: spec.buyer.id,
          body: "Photos attached. The outer box looked fine but the lamp was chipped.",
        },
        {
          disputeId: dispute.id,
          authorRole: "staff",
          authorUserId: ownerUser.id,
          body: "Thank you — we've frozen the held funds and asked the studio to respond.",
        },
      ]);
    }
  }

  for (const c of certificateItems) {
    const v = DEMO_VENDORS.find((x) => x.slug === c.vendorSlug)!;
    const p = DEMO_PRODUCTS.find((x) => x.title === c.productTitle)!;
    const code = `WB-COA-${(certificateItems.indexOf(c) + 1).toString().padStart(5, "0")}`;
    const [cert] = await db
      .insert(t.certificates)
      .values({
        code,
        productId: productIds.get(c.productTitle),
        orderItemId: c.itemId,
        vendorId: vendorIds.get(c.vendorSlug)!,
        artisanName: v.displayName,
        craft: v.craft,
        title: p.title,
        materials: p.materials,
        region: `${v.city}, Pakistan`,
        madeOn: c.createdAt.toISOString().slice(0, 10),
      })
      .returning();
    await db.update(t.orderItems).set({ certificateId: cert.id }).where(eq(t.orderItems.id, c.itemId));
  }

  // Collections & a bundle
  const coll = async (
    slug: string,
    title: string,
    description: string,
    kind: "collection" | "bundle",
    titles: string[],
    cover: string,
    bundleDiscountBps?: number,
  ) => {
    const [c] = await db
      .insert(t.collections)
      .values({ slug, title, description, kind, isPublished: true, coverImageUrl: cover, bundleDiscountBps, isDemo: true })
      .returning();
    await db.insert(t.collectionProducts).values(titles.map((ti, sort) => ({ collectionId: c.id, productId: productIds.get(ti)!, sort })));
  };
  await coll(
    "complete-the-reading-nook",
    "Complete the reading nook",
    "A calligraphy print for the wall, a small rug underfoot and a pair of stone bookends for the shelf.",
    "bundle",
    ["Mohabbat — archival giclée print", "Rust & ivory prayer-size rug, 3×5 ft", "Schist bookends, pair"],
    art("rug", 777, "wide"),
  );
  await coll(
    "blue-and-gold",
    "Blue & gold",
    "Cobalt glaze, indigo grounds and gold leaf — pieces that sit together.",
    "collection",
    ["Noor — single-word panel", "Multani blue charger plate, 45 cm", "Tall floral vase", "Kashi tile panel, 4 tiles"],
    art("tile", 778, "wide"),
  );
  await coll(
    "gifts-that-travel-well",
    "Gifts that travel well",
    "Lighter pieces that ship quickly and arrive gift-ready.",
    "collection",
    [
      "Classic ajrak — hand block-printed cloth",
      "Salt tealight holders, set of four",
      "Badshahi skyline — screen print",
      "Ajrak cushion covers, pair",
      "Blue pottery bowl",
    ],
    art("ajrak", 779, "wide"),
  );

  // Journal
  for (const [i, j] of DEMO_JOURNAL.entries())
    await db.insert(t.journalPosts).values({
      slug: j.slug,
      title: j.title,
      excerpt: j.excerpt,
      body: j.body,
      coverImageUrl: art(j.art, j.seed, "wide"),
      categoryId: catId(j.category),
      authorName: "Wahbayaan Journal",
      status: "published",
      publishedAt: daysAgo(30 - i * 6),
      isDemo: true,
    });

  // Requests, leads, messages
  await db.insert(t.customRequests).values([
    {
      number: "REQ-2001",
      userId: usBuyer.id,
      name: usBuyer.name,
      email: usBuyer.email,
      vendorId: vendorIds.get("noor-calligraphy-atelier"),
      categoryId: catId("calligraphy-art"),
      details: "A wedding gift: the couple's names in Nastaliq, gold on indigo, about 60×40 cm.",
      customText: "Ayesha & Omar",
      sizeNotes: "About 60 × 40 cm",
      budget: 600_00,
      budgetCurrency: "USD",
      destinationCountry: "US",
      status: "quoted",
      quotePkr: 150_000_00,
      quoteDays: 21,
      quoteMessage: "Happy to — I'll send two sketches within a week.",
      quotedAt: daysAgo(1),
    },
    {
      number: "REQ-2002",
      userId: ukBuyer.id,
      name: ukBuyer.name,
      email: ukBuyer.email,
      categoryId: catId("rugs"),
      details: "A runner exactly 70 × 380 cm for a narrow hallway, in indigo.",
      sizeNotes: "70 × 380 cm",
      colorNotes: "Indigo and ivory",
      destinationCountry: "GB",
      status: "new",
    },
  ]);
  await db.insert(t.wholesaleApplications).values({
    businessName: "Demo Interior Studio",
    contactName: "Demo Designer",
    email: "designer@wahbayaan.test",
    country: "US",
    businessType: "interior_designer",
    expectedVolume: "10–20 pieces per quarter",
    message: "We furnish boutique hotels and would like trade pricing on rugs and pottery.",
    status: "approved",
  });
  await db.insert(t.contactMessages).values([
    { name: "Demo Visitor", email: "visitor@example.test", topic: "Duties", message: "Roughly how much duty would I pay on a rug to Canada?", status: "new" },
    {
      name: "Demo Buyer (US)",
      email: usBuyer.email,
      topic: "Order",
      orderNumber: "WB-1005",
      message: "Can I change the gift message on my order?",
      status: "open",
    },
  ]);
  await db.insert(t.newsletterSubscribers).values([
    { email: "reader1@example.test", source: "footer" },
    { email: "reader2@example.test", source: "journal" },
  ]);
  await db.insert(t.waitlistEntries).values({ productId: productIds.get("Carved salt sculpture — minaret")!, email: usBuyer.email, userId: usBuyer.id });
  const [conv] = await db
    .insert(t.conversations)
    .values({
      buyerId: usBuyer.id,
      vendorId: vendorIds.get("qila-rug-workshop")!,
      productId: productIds.get("Madder-red Bukhara, 6×9 ft"),
      subject: "Question about the Bukhara rug",
    })
    .returning();
  await db.insert(t.messages).values([
    { conversationId: conv.id, senderUserId: usBuyer.id, body: "Is the red closer to brick or to wine in daylight?", createdAt: daysAgo(3) },
    {
      conversationId: conv.id,
      senderUserId: (await db.query.vendors.findFirst({ where: eq(t.vendors.slug, "qila-rug-workshop") }))!.userId,
      body: "Closer to wine — I can send a daylight video tomorrow.",
      createdAt: daysAgo(2),
    },
  ]);
  await db.insert(t.coupons).values({ code: "WELCOME-DEMO", description: "Demo coupon — 10% off", kind: "percent", percentBps: 1000, isActive: true });
  await db.insert(t.notifications).values([
    { userId: usBuyer.id, kind: "order", title: "Your order WB-1005 is being made", link: "/account/orders/WB-1005" },
    { userId: ownerUser.id, kind: "dispute", title: "New case CASE-1007 needs review", link: "/admin/disputes" },
  ]);
  await db.insert(t.auditLog).values({ actorUserId: ownerUser.id, action: "seed", entity: "system", summary: "Demo data loaded" });

  await db.insert(t.announcements).values(DEMO_ANNOUNCEMENT);
  await seedBrandsDemo(db, { ownerId: ownerUser.id, usBuyerId: usBuyer.id, passwordHash: pw });

  console.log(`Demo data: ${DEMO_VENDORS.length} artisans, ${DEMO_PRODUCTS.length} listings, ${reviewCount} sample reviews, ${specs.length} orders.`);
  console.log(`Demo logins (password "${DEMO_PASSWORD}"): admin@wahbayaan.test · buyer@wahbayaan.test · noor-calligraphy-atelier@artisans.wahbayaan.test`);
}

async function main() {
  const db = await getDb();
  await seedBase(db);
  if (process.env.DEMO_MODE === "true" || process.argv.includes("--demo")) await seedDemo(db);
  await closeDb();
  console.log("Seed complete.");
}

if (process.argv[1]?.endsWith("seed.ts")) {
  main().catch(async (err) => {
    console.error(err);
    await closeDb();
    process.exit(1);
  });
}
