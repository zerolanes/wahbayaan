/**
 * Wahbayaan data model.
 *
 * Money conventions
 * - Every amount is an integer in minor units (paisa, cents, pence).
 * - Seller-side amounts are PKR and their columns end in `Pkr`.
 * - Buyer-side amounts are in the order's `currency` (USD/GBP/CAD for overseas
 *   buyers, PKR for buyers in Pakistan or when explicitly chosen) and have no suffix.
 *
 * Rates that depend on real contracts (duty, courier, handling fee, commission)
 * carry a `status`; `pending` means "no real data yet" and must be shown to the
 * buyer as pending, never as zero.
 */
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const money = (name: string) => bigint(name, { mode: "number" });
const isDemo = () => boolean("is_demo").notNull().default(false);

// ── Enums ───────────────────────────────────────────────────────────────────

export const userRole = pgEnum("user_role", ["buyer", "seller", "staff"]);
export const accountStatus = pgEnum("account_status", ["active", "suspended"]);
export const pkRegion = pgEnum("pk_region", [
  "punjab",
  "sindh",
  "khyber_pakhtunkhwa",
  "balochistan",
  "gilgit_baltistan",
  "azad_kashmir",
  "islamabad",
]);
export const vendorStatus = pgEnum("vendor_status", ["applied", "in_review", "verified", "suspended", "rejected"]);
export const applicationStatus = pgEnum("application_status", [
  "submitted",
  "in_review",
  "more_info",
  "approved",
  "rejected",
]);
export const verificationKind = pgEnum("verification_kind", [
  "identity",
  "workshop",
  "samples",
  "video_call",
  "address",
]);
export const checkStatus = pgEnum("check_status", ["pending", "passed", "failed"]);
export const imageKind = pgEnum("image_kind", ["photo", "illustration"]);
export const productStatus = pgEnum("product_status", ["draft", "pending_review", "active", "rejected", "archived"]);
export const availability = pgEnum("availability", ["ready_to_ship", "made_to_order"]);
export const reviewStatus = pgEnum("review_status", ["pending", "published", "hidden"]);
export const orderStatus = pgEnum("order_status", [
  "awaiting_quote", // shipping/duty could not be priced automatically; staff quote first
  "quote_sent",
  "awaiting_payment",
  "paid", // funds held by Wahbayaan
  "in_fulfilment",
  "shipped",
  "delivered",
  "completed", // buyer confirmed or protection window passed; funds released
  "cancelled",
  "refunded",
  "disputed",
]);
export const paymentStatus = pgEnum("payment_status", [
  "unpaid",
  "paid",
  "refunded",
  "partially_refunded",
  "failed",
]);
export const fundsState = pgEnum("funds_state", ["none", "held", "released", "refunded", "frozen"]);
export const lineStatus = pgEnum("line_status", ["known", "pending", "not_applicable"]);
export const vendorOrderStatus = pgEnum("vendor_order_status", [
  "pending",
  "accepted",
  "in_production",
  "ready_to_ship",
  "shipped",
  "delivered",
  "cancelled",
]);
export const paymentRecordStatus = pgEnum("payment_record_status", ["pending", "succeeded", "failed", "refunded"]);
export const refundStatus = pgEnum("refund_status", ["requested", "approved", "processed", "rejected"]);
export const payoutStatus = pgEnum("payout_status", ["pending", "scheduled", "paid", "on_hold", "failed"]);
export const disputeReason = pgEnum("dispute_reason", [
  "damaged",
  "not_as_described",
  "not_received",
  "wrong_item",
  "other",
]);
export const disputeStatus = pgEnum("dispute_status", [
  "open",
  "awaiting_seller",
  "awaiting_buyer",
  "under_review",
  "resolved",
  "closed",
]);
export const disputeResolution = pgEnum("dispute_resolution", [
  "refund",
  "partial_refund",
  "replacement",
  "no_action",
]);
export const rateStatus = pgEnum("rate_status", ["placeholder", "manual", "live"]);
export const configStatus = pgEnum("config_status", ["pending", "active", "disabled"]);
export const dutyBasis = pgEnum("duty_basis", ["item", "item_plus_shipping"]);
export const ruleLevel = pgEnum("rule_level", ["info", "warning", "restricted", "prohibited"]);
export const collectionKind = pgEnum("collection_kind", ["collection", "bundle"]);
export const publishStatus = pgEnum("publish_status", ["draft", "published"]);
export const customRequestStatus = pgEnum("custom_request_status", [
  "new",
  "quoted",
  "accepted",
  "declined",
  "expired",
  "converted",
  "cancelled",
]);
export const ticketStatus = pgEnum("ticket_status", ["new", "open", "resolved"]);
export const leadStatus = pgEnum("lead_status", ["new", "contacted", "approved", "rejected"]);
/** `artisan`: the cross-border handmade marketplace. `brand`: Pakistani Brands personal-shopping orders. */
export const orderKind = pgEnum("order_kind", ["artisan", "brand"]);
export const brandSourceType = pgEnum("brand_source_type", ["shopify_json", "csv_feed", "manual"]);
/** Formal relationship with the brand. Only `authorised` may ever be described as official. */
export const brandPartnership = pgEnum("brand_partnership", ["none", "requested", "authorised"]);
export const brandAudience = pgEnum("brand_audience", ["women", "men", "kids", "unisex"]);
export const brandProductStatus = pgEnum("brand_product_status", ["draft", "published", "hidden"]);
export const brandSyncStatus = pgEnum("brand_sync_status", ["running", "succeeded", "partial", "failed", "refused"]);
export const brandFulfilmentStatus = pgEnum("brand_fulfilment_status", [
  "pending", // order placed with Wahbayaan, not yet bought from the brand
  "ordered_from_brand",
  "received_at_wahbayaan",
  "dispatched",
  "delivered",
  "cancelled",
]);

// ── Identity & access ───────────────────────────────────────────────────────

export const staffRoles = pgTable("staff_roles", {
  id: id(),
  name: text("name").notNull().unique(),
  description: text("description"),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: createdAt(),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    name: text("name").notNull(),
    role: userRole("role").notNull().default("buyer"),
    staffRoleId: uuid("staff_role_id").references(() => staffRoles.id, { onDelete: "set null" }),
    status: accountStatus("status").notNull().default("active"),
    country: text("country"),
    preferredCurrency: text("preferred_currency"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    isWholesale: boolean("is_wholesale").notNull().default(false),
    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
    isDemo: isDemo(),
  },
  (t) => [uniqueIndex("users_email_idx").on(sql`lower(${t.email})`)],
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  userAgent: text("user_agent"),
  createdAt: createdAt(),
});

export const addresses = pgTable("addresses", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  label: text("label"),
  fullName: text("full_name").notNull(),
  line1: text("line1").notNull(),
  line2: text("line2"),
  city: text("city").notNull(),
  region: text("region"),
  postalCode: text("postal_code"),
  country: text("country").notNull(),
  phone: text("phone"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: createdAt(),
});

// ── Artisans (vendors) ──────────────────────────────────────────────────────

export const categories = pgTable("categories", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  coverKind: imageKind("cover_kind"),
  hsCode: text("hs_code"),
  sort: integer("sort").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(true),
  showOnHome: boolean("show_on_home").notNull().default(true),
  createdAt: createdAt(),
  isDemo: isDemo(),
});

export const vendors = pgTable("vendors", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  craft: text("craft").notNull(),
  primaryCategoryId: uuid("primary_category_id").references(() => categories.id, { onDelete: "set null" }),
  tagline: text("tagline"),
  story: text("story"),
  craftHistory: text("craft_history"),
  workshopCity: text("workshop_city"),
  workshopRegion: pkRegion("workshop_region"),
  foundedYear: integer("founded_year"),
  profilePhotoUrl: text("profile_photo_url"),
  profilePhotoKind: imageKind("profile_photo_kind"),
  bannerUrl: text("banner_url"),
  storyVideoUrl: text("story_video_url"),
  languages: jsonb("languages").$type<string[]>().notNull().default([]),
  status: vendorStatus("status").notNull().default("applied"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  locationVerified: boolean("location_verified").notNull().default(false),
  commissionBps: integer("commission_bps"),
  responseTimeHours: integer("response_time_hours"),
  isFeatured: boolean("is_featured").notNull().default(false),
  acceptsCustomOrders: boolean("accepts_custom_orders").notNull().default(true),
  vacationMode: boolean("vacation_mode").notNull().default(false),
  payoutMethod: text("payout_method"),
  payoutAccountTitle: text("payout_account_title"),
  payoutBankName: text("payout_bank_name"),
  payoutAccountLast4: text("payout_account_last4"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  isDemo: isDemo(),
});

export const vendorApplications = pgTable("vendor_applications", {
  id: id(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  craft: text("craft").notNull(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  workshopCity: text("workshop_city"),
  workshopRegion: pkRegion("workshop_region"),
  yearsPracticing: integer("years_practicing"),
  portfolioUrl: text("portfolio_url"),
  instagram: text("instagram"),
  samplePhotoUrls: jsonb("sample_photo_urls").$type<string[]>().notNull().default([]),
  videoUrl: text("video_url"),
  story: text("story"),
  exportedBefore: boolean("exported_before").notNull().default(false),
  status: applicationStatus("status").notNull().default("submitted"),
  reviewerId: uuid("reviewer_id").references(() => users.id, { onDelete: "set null" }),
  reviewerNotes: text("reviewer_notes"),
  vendorId: uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
});

export const verificationChecks = pgTable("verification_checks", {
  id: id(),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id, { onDelete: "cascade" }),
  kind: verificationKind("kind").notNull(),
  status: checkStatus("status").notNull().default("pending"),
  notes: text("notes"),
  checkedById: uuid("checked_by_id").references(() => users.id, { onDelete: "set null" }),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// ── Catalogue ───────────────────────────────────────────────────────────────

export type CustomizationOption = {
  id: string;
  label: string;
  kind: "text" | "select";
  choices?: string[];
  required?: boolean;
  maxLength?: number;
  extraPricePkr?: number;
};

/**
 * 3D presentation of a listing.
 * - `scan`: a GLB model uploaded for this exact piece (photogrammetry/3D scan).
 * - `procedural`: a generated craft model; always labelled "illustrative" to buyers.
 */
export type Model3d =
  | { source: "scan"; url: string }
  | { source: "procedural"; kind: string; seed: number };

export const products = pgTable(
  "products",
  {
    id: id(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary"),
    description: text("description"),
    story: text("story"),
    pricePkr: money("price_pkr").notNull(),
    compareAtPricePkr: money("compare_at_price_pkr"),
    status: productStatus("status").notNull().default("draft"),
    rejectionReason: text("rejection_reason"),
    availability: availability("availability").notNull().default("ready_to_ship"),
    stockQty: integer("stock_qty").notNull().default(1),
    isOneOfAKind: boolean("is_one_of_a_kind").notNull().default(false),
    timeToMakeDays: integer("time_to_make_days"),
    dispatchDays: integer("dispatch_days"),
    widthCm: numeric("width_cm"),
    heightCm: numeric("height_cm"),
    depthCm: numeric("depth_cm"),
    weightG: integer("weight_g"),
    materials: jsonb("materials").$type<string[]>().notNull().default([]),
    techniques: jsonb("techniques").$type<string[]>().notNull().default([]),
    careInstructions: text("care_instructions"),
    region: pkRegion("region"),
    customizable: boolean("customizable").notNull().default(false),
    customizationOptions: jsonb("customization_options").$type<CustomizationOption[]>().notNull().default([]),
    videoUrl: text("video_url"),
    model3d: jsonb("model_3d").$type<Model3d>(),
    isFeatured: boolean("is_featured").notNull().default(false),
    isLimitedDrop: boolean("is_limited_drop").notNull().default(false),
    dropStartsAt: timestamp("drop_starts_at", { withTimezone: true }),
    editionSize: integer("edition_size"),
    hsCodeOverride: text("hs_code_override"),
    wholesaleEnabled: boolean("wholesale_enabled").notNull().default(false),
    wholesaleMinQty: integer("wholesale_min_qty"),
    wholesalePricePkr: money("wholesale_price_pkr"),
    viewCount: integer("view_count").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    isDemo: isDemo(),
  },
  (t) => [index("products_vendor_idx").on(t.vendorId), index("products_category_idx").on(t.categoryId)],
);

export const productImages = pgTable("product_images", {
  id: id(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  alt: text("alt"),
  kind: imageKind("kind").notNull().default("photo"),
  sort: integer("sort").notNull().default(0),
});

export const reviews = pgTable("reviews", {
  id: id(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  orderItemId: uuid("order_item_id"),
  authorName: text("author_name").notNull(),
  buyerCountry: text("buyer_country"),
  rating: integer("rating").notNull(),
  title: text("title"),
  body: text("body").notNull(),
  status: reviewStatus("status").notNull().default("pending"),
  sellerReply: text("seller_reply"),
  sellerRepliedAt: timestamp("seller_replied_at", { withTimezone: true }),
  createdAt: createdAt(),
  isDemo: isDemo(),
});

export const reviewPhotos = pgTable("review_photos", {
  id: id(),
  reviewId: uuid("review_id")
    .notNull()
    .references(() => reviews.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
});

/** `ownerKey` is `user:<uuid>` for signed-in buyers or `visitor:<id>` for guests. */
export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: id(),
    ownerKey: text("owner_key").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("wishlist_owner_product_idx").on(t.ownerKey, t.productId)],
);

export const collections = pgTable("collections", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  kind: collectionKind("kind").notNull().default("collection"),
  bundleDiscountBps: integer("bundle_discount_bps"),
  isPublished: boolean("is_published").notNull().default(false),
  sort: integer("sort").notNull().default(0),
  createdAt: createdAt(),
  isDemo: isDemo(),
});

export const collectionProducts = pgTable(
  "collection_products",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.productId] })],
);

export const waitlistEntries = pgTable(
  "waitlist_entries",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("waitlist_product_email_idx").on(t.productId, t.email)],
);

// ── Cart & orders ───────────────────────────────────────────────────────────

export const carts = pgTable("carts", {
  id: id(),
  ownerKey: text("owner_key").notNull().unique(),
  couponCode: text("coupon_code"),
  isGift: boolean("is_gift").notNull().default(false),
  giftWrap: boolean("gift_wrap").notNull().default(false),
  giftMessage: text("gift_message"),
  updatedAt: updatedAt(),
});

export const cartItems = pgTable("cart_items", {
  id: id(),
  cartId: uuid("cart_id")
    .notNull()
    .references(() => carts.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  qty: integer("qty").notNull().default(1),
  customization: jsonb("customization").$type<Record<string, string>>().notNull().default({}),
  createdAt: createdAt(),
});

export type OrderAddress = {
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode?: string | null;
  country: string;
  phone?: string | null;
};

export const orders = pgTable(
  "orders",
  {
    id: id(),
    number: text("number").notNull().unique(),
    kind: orderKind("kind").notNull().default("artisan"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    customerName: text("customer_name").notNull(),
    currency: text("currency").notNull(),
    fxPkrPerUnit: numeric("fx_pkr_per_unit").notNull(),
    fxSource: text("fx_source").notNull(),
    destinationCountry: text("destination_country").notNull(),
    shippingAddress: jsonb("shipping_address").$type<OrderAddress>().notNull(),
    status: orderStatus("status").notNull().default("awaiting_payment"),
    paymentStatus: paymentStatus("payment_status").notNull().default("unpaid"),
    fundsState: fundsState("funds_state").notNull().default("none"),
    itemsSubtotal: money("items_subtotal").notNull(),
    shippingAmount: money("shipping_amount"),
    shippingStatus: lineStatus("shipping_status").notNull().default("pending"),
    dutyAmount: money("duty_amount"),
    dutyStatus: lineStatus("duty_status").notNull().default("pending"),
    importTaxAmount: money("import_tax_amount"),
    importTaxStatus: lineStatus("import_tax_status").notNull().default("pending"),
    handlingAmount: money("handling_amount"),
    handlingStatus: lineStatus("handling_status").notNull().default("pending"),
    giftWrapAmount: money("gift_wrap_amount"),
    /** Pakistani Brands: Wahbayaan's service fee, shown to the buyer as its own line. */
    serviceFeeAmount: money("service_fee_amount"),
    serviceFeeStatus: lineStatus("service_fee_status").notNull().default("not_applicable"),
    /** Cash-on-delivery fee (domestic brand orders paying COD). */
    codFeeAmount: money("cod_fee_amount"),
    codFeeStatus: lineStatus("cod_fee_status").notNull().default("not_applicable"),
    /** `card` (the active provider), `cod`, or a pending provider id. Null on artisan orders (card). */
    paymentMethod: text("payment_method"),
    discountAmount: money("discount_amount").notNull().default(0),
    total: money("total").notNull(),
    totalComplete: boolean("total_complete").notNull().default(false),
    couponCode: text("coupon_code"),
    referralCode: text("referral_code"),
    isGift: boolean("is_gift").notNull().default(false),
    giftWrap: boolean("gift_wrap").notNull().default(false),
    giftMessage: text("gift_message"),
    buyerNotes: text("buyer_notes"),
    quoteNote: text("quote_note"),
    quoteSentAt: timestamp("quote_sent_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    autoReleaseAt: timestamp("auto_release_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    isDemo: isDemo(),
  },
  (t) => [index("orders_user_idx").on(t.userId), index("orders_status_idx").on(t.status)],
);

export const vendorOrders = pgTable(
  "vendor_orders",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    status: vendorOrderStatus("status").notNull().default("pending"),
    subtotalPkr: money("subtotal_pkr").notNull(),
    commissionBps: integer("commission_bps"),
    commissionPkr: money("commission_pkr"),
    netPkr: money("net_pkr"),
    courier: text("courier"),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    packageWeightG: integer("package_weight_g"),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    payoutId: uuid("payout_id"),
    sellerNote: text("seller_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("vendor_orders_vendor_idx").on(t.vendorId)],
);

export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  vendorOrderId: uuid("vendor_order_id")
    .notNull()
    .references(() => vendorOrders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  imageUrl: text("image_url"),
  hsCode: text("hs_code"),
  qty: integer("qty").notNull(),
  unitPricePkr: money("unit_price_pkr").notNull(),
  unitPrice: money("unit_price").notNull(),
  customization: jsonb("customization").$type<Record<string, string>>().notNull().default({}),
  certificateId: uuid("certificate_id"),
});

export const orderEvents = pgTable("order_events", {
  id: id(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  vendorOrderId: uuid("vendor_order_id"),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  visibleToBuyer: boolean("visible_to_buyer").notNull().default(true),
  createdAt: createdAt(),
});

export const payments = pgTable("payments", {
  id: id(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerRef: text("provider_ref"),
  amount: money("amount").notNull(),
  currency: text("currency").notNull(),
  status: paymentRecordStatus("status").notNull().default("pending"),
  mode: text("mode").notNull(), // "test" | "live"
  raw: jsonb("raw"),
  createdAt: createdAt(),
});

export const refunds = pgTable("refunds", {
  id: id(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  disputeId: uuid("dispute_id"),
  amount: money("amount").notNull(),
  currency: text("currency").notNull(),
  reason: text("reason").notNull(),
  status: refundStatus("status").notNull().default("requested"),
  createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const payouts = pgTable("payouts", {
  id: id(),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id, { onDelete: "restrict" }),
  amountPkr: money("amount_pkr").notNull(),
  status: payoutStatus("status").notNull().default("pending"),
  method: text("method"),
  reference: text("reference"),
  notes: text("notes"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const disputes = pgTable("disputes", {
  id: id(),
  number: text("number").notNull().unique(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  vendorOrderId: uuid("vendor_order_id").references(() => vendorOrders.id, { onDelete: "set null" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  reason: disputeReason("reason").notNull(),
  description: text("description").notNull(),
  desiredOutcome: text("desired_outcome"),
  evidenceUrls: jsonb("evidence_urls").$type<string[]>().notNull().default([]),
  status: disputeStatus("status").notNull().default("open"),
  resolution: disputeResolution("resolution"),
  resolutionNote: text("resolution_note"),
  assignedToId: uuid("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const disputeMessages = pgTable("dispute_messages", {
  id: id(),
  disputeId: uuid("dispute_id")
    .notNull()
    .references(() => disputes.id, { onDelete: "cascade" }),
  authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
  authorRole: text("author_role").notNull(), // buyer | seller | staff
  body: text("body").notNull(),
  createdAt: createdAt(),
});

export const certificates = pgTable("certificates", {
  id: id(),
  code: text("code").notNull().unique(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  orderItemId: uuid("order_item_id"),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id, { onDelete: "restrict" }),
  artisanName: text("artisan_name").notNull(),
  craft: text("craft").notNull(),
  title: text("title").notNull(),
  materials: jsonb("materials").$type<string[]>().notNull().default([]),
  region: text("region"),
  madeOn: date("made_on"),
  status: text("status").notNull().default("issued"), // issued | void
  issuedAt: createdAt(),
});

// ── Pakistani Brands (personal-shopping service) ───────────────────────────
//
// A separate catalogue from the artisan marketplace: brand products never live in
// `products`, so the artisan visibility guards, vendor payouts and seller
// dashboard are untouched. Wahbayaan buys from the brand on the buyer's behalf.

/** Size chart shown on brand product pages, as published by the brand (or entered by staff). */
export type BrandSizeGuide = { unit: "in" | "cm"; columns: string[]; rows: { size: string; values: string[] }[]; note?: string | null };

export const brands = pgTable("brands", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  websiteUrl: text("website_url"),
  description: text("description"),
  audiences: jsonb("audiences").$type<("women" | "men" | "kids" | "unisex")[]>().notNull().default([]),
  partnership: brandPartnership("partnership").notNull().default("none"),
  partnershipNote: text("partnership_note"),
  /** Permission to list / import this brand's catalogue. Sync cannot be enabled until it is recorded. */
  permissionGrantedAt: timestamp("permission_granted_at", { withTimezone: true }),
  permissionGrantedById: uuid("permission_granted_by_id").references(() => users.id, { onDelete: "set null" }),
  permissionNote: text("permission_note"),
  permissionEvidenceUrl: text("permission_evidence_url"),
  /** Shown in the storefront directory (still subject to the visibility guards). */
  isActive: boolean("is_active").notNull().default(false),
  sizeGuide: jsonb("size_guide").$type<BrandSizeGuide>(),
  /** Used for shipping estimates when a product has no weight. */
  defaultWeightG: integer("default_weight_g"),
  sort: integer("sort").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  isDemo: isDemo(),
});

export type BrandSourceConfig = {
  /** shopify_json: the store's products.json URL (or `fixture:<name>` outside production). */
  url?: string | null;
  /** Minimum delay between requests to the brand's site. Never below 1000 ms. */
  rateLimitMs?: number;
  maxPages?: number;
  /** Currency the brand prices in. Only PKR is accepted — nothing is converted on import. */
  currency?: string;
  /** After a complete feed, mark products that disappeared from it as unavailable. */
  markMissingUnavailable?: boolean;
};

export const brandSources = pgTable("brand_sources", {
  id: id(),
  brandId: uuid("brand_id")
    .notNull()
    .unique()
    .references(() => brands.id, { onDelete: "cascade" }),
  type: brandSourceType("type").notNull().default("manual"),
  config: jsonb("config").$type<BrandSourceConfig>().notNull().default({}),
  /** Automatic sync (admin button + cron). Refused while no permission is recorded on the brand. */
  syncEnabled: boolean("sync_enabled").notNull().default(false),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const brandSyncRuns = pgTable(
  "brand_sync_runs",
  {
    id: id(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    sourceType: brandSourceType("source_type").notNull(),
    trigger: text("trigger").notNull(), // admin | cron | upload
    status: brandSyncStatus("status").notNull().default("running"),
    added: integer("added").notNull().default(0),
    updated: integer("updated").notNull().default(0),
    unchanged: integer("unchanged").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    markedUnavailable: integer("marked_unavailable").notNull().default(0),
    errors: jsonb("errors").$type<string[]>().notNull().default([]),
    triggeredById: uuid("triggered_by_id").references(() => users.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("brand_sync_runs_brand_idx").on(t.brandId)],
);

export const brandProducts = pgTable(
  "brand_products",
  {
    id: id(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    /** Id in the brand's own catalogue (null for manual entries). */
    externalId: text("external_id"),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    audience: brandAudience("audience").notNull().default("women"),
    category: text("category"),
    collection: text("collection"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    fabric: text("fabric"),
    /** The product's page on the brand's website. Always linked from the storefront. */
    sourceUrl: text("source_url"),
    /** Brand's retail price (lowest variant), PKR minor units. */
    pricePkr: money("price_pkr").notNull(),
    /** Brand's original price when the item is on sale. */
    compareAtPricePkr: money("compare_at_price_pkr"),
    /** Staff override of the item price Wahbayaan charges (the service fee is always separate). */
    priceOverridePkr: money("price_override_pkr"),
    weightG: integer("weight_g"),
    hsCode: text("hs_code"),
    status: brandProductStatus("status").notNull().default("draft"),
    /** When the brand published it (drives "new arrivals"). */
    sourcePublishedAt: timestamp("source_published_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    /** Fingerprint of the last imported source data — unchanged products are skipped. */
    sourceHash: text("source_hash"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    isDemo: isDemo(),
  },
  (t) => [index("brand_products_brand_idx").on(t.brandId), uniqueIndex("brand_products_external_idx").on(t.brandId, t.externalId)],
);

export const brandProductImages = pgTable("brand_product_images", {
  id: id(),
  productId: uuid("product_id")
    .notNull()
    .references(() => brandProducts.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  alt: text("alt"),
  kind: imageKind("kind").notNull().default("photo"),
  sort: integer("sort").notNull().default(0),
});

export const brandProductVariants = pgTable(
  "brand_product_variants",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => brandProducts.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    sku: text("sku"),
    size: text("size"),
    colour: text("colour"),
    /** Variant price when it differs from the product price. */
    pricePkr: money("price_pkr"),
    compareAtPricePkr: money("compare_at_price_pkr"),
    /** Null = the brand doesn't publish stock counts; availability is confirmed when we order. */
    stockQty: integer("stock_qty"),
    available: boolean("available").notNull().default(true),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("brand_variants_product_idx").on(t.productId)],
);

export const brandCarts = pgTable("brand_carts", {
  id: id(),
  ownerKey: text("owner_key").notNull().unique(),
  /** `PK` = deliver inside Pakistan (a domestic buyer, or an overseas buyer's gift); `home` = ship to the buyer's own country. */
  shipTo: text("ship_to").notNull().default("home"),
  isGift: boolean("is_gift").notNull().default(false),
  giftMessage: text("gift_message"),
  updatedAt: updatedAt(),
});

export const brandCartItems = pgTable(
  "brand_cart_items",
  {
    id: id(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => brandCarts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => brandProductVariants.id, { onDelete: "cascade" }),
    qty: integer("qty").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("brand_cart_variant_idx").on(t.cartId, t.variantId)],
);

export const brandOrderItems = pgTable("brand_order_items", {
  id: id(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "restrict" }),
  productId: uuid("product_id").references(() => brandProducts.id, { onDelete: "set null" }),
  variantId: uuid("variant_id").references(() => brandProductVariants.id, { onDelete: "set null" }),
  brandName: text("brand_name").notNull(),
  title: text("title").notNull(),
  size: text("size"),
  colour: text("colour"),
  sku: text("sku"),
  sourceUrl: text("source_url"),
  imageUrl: text("image_url"),
  qty: integer("qty").notNull(),
  unitPricePkr: money("unit_price_pkr").notNull(),
  unitPrice: money("unit_price").notNull(),
});

/** Wahbayaan buys from the brand on the buyer's behalf: one checklist per brand per order. */
export const brandFulfilments = pgTable(
  "brand_fulfilments",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "restrict" }),
    status: brandFulfilmentStatus("status").notNull().default("pending"),
    brandOrderRef: text("brand_order_ref"),
    /** What Wahbayaan actually paid the brand (PKR). */
    purchaseCostPkr: money("purchase_cost_pkr"),
    courier: text("courier"),
    trackingNumber: text("tracking_number"),
    notes: text("notes"),
    orderedAt: timestamp("ordered_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("brand_fulfilment_order_brand_idx").on(t.orderId, t.brandId)],
);

// ── Cross-border rates (business data; pending until supplied) ──────────────

export const fxRates = pgTable("fx_rates", {
  currency: text("currency").primaryKey(),
  pkrPerUnit: numeric("pkr_per_unit").notNull(),
  source: text("source").notNull(),
  status: rateStatus("status").notNull(),
  updatedAt: updatedAt(),
});

export const shippingRates = pgTable("shipping_rates", {
  id: id(),
  courier: text("courier").notNull(),
  serviceName: text("service_name"),
  destinationCountry: text("destination_country").notNull(),
  minWeightG: integer("min_weight_g").notNull().default(0),
  maxWeightG: integer("max_weight_g").notNull(),
  amount: money("amount"),
  currency: text("currency").notNull().default("PKR"),
  transitDaysMin: integer("transit_days_min"),
  transitDaysMax: integer("transit_days_max"),
  status: configStatus("status").notNull().default("pending"),
  source: text("source"),
  notes: text("notes"),
  updatedAt: updatedAt(),
});

export const dutyRates = pgTable("duty_rates", {
  id: id(),
  destinationCountry: text("destination_country").notNull(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }),
  hsCode: text("hs_code"),
  dutyPercent: numeric("duty_percent"),
  taxPercent: numeric("tax_percent"),
  taxLabel: text("tax_label"),
  deMinimisAmount: money("de_minimis_amount"),
  deMinimisCurrency: text("de_minimis_currency"),
  basis: dutyBasis("basis").notNull().default("item_plus_shipping"),
  status: configStatus("status").notNull().default("pending"),
  source: text("source"),
  notes: text("notes"),
  updatedAt: updatedAt(),
});

export const importRules = pgTable("import_rules", {
  id: id(),
  destinationCountry: text("destination_country").notNull(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }),
  level: ruleLevel("level").notNull(),
  message: text("message").notNull(),
  status: configStatus("status").notNull().default("pending"),
  source: text("source"),
  updatedAt: updatedAt(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

export const coupons = pgTable("coupons", {
  id: id(),
  code: text("code").notNull().unique(),
  description: text("description"),
  kind: text("kind").notNull(), // percent | fixed
  percentBps: integer("percent_bps"),
  amount: money("amount"),
  currency: text("currency"),
  minSubtotal: money("min_subtotal"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

// ── Content ─────────────────────────────────────────────────────────────────

export const journalPosts = pgTable("journal_posts", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt"),
  body: text("body").notNull(),
  coverImageUrl: text("cover_image_url"),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  authorName: text("author_name"),
  status: publishStatus("status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  isDemo: isDemo(),
});

export const pages = pgTable("pages", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  seoDescription: text("seo_description"),
  status: publishStatus("status").notNull().default("published"),
  updatedAt: updatedAt(),
});

export const faqs = pgTable("faqs", {
  id: id(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  group: text("group").notNull().default("General"),
  sort: integer("sort").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
});

export const announcements = pgTable("announcements", {
  id: id(),
  message: text("message").notNull(),
  link: text("link"),
  isActive: boolean("is_active").notNull().default(false),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const redirects = pgTable("redirects", {
  id: id(),
  fromPath: text("from_path").notNull().unique(),
  toPath: text("to_path").notNull(),
  permanent: boolean("permanent").notNull().default(true),
  hits: integer("hits").notNull().default(0),
  createdAt: createdAt(),
});

export const media = pgTable("media", {
  id: id(),
  url: text("url").notNull(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  alt: text("alt"),
  uploadedById: uuid("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

// ── Requests, leads & growth ────────────────────────────────────────────────

export const customRequests = pgTable("custom_requests", {
  id: id(),
  number: text("number").notNull().unique(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  vendorId: uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  details: text("details").notNull(),
  customText: text("custom_text"),
  sizeNotes: text("size_notes"),
  colorNotes: text("color_notes"),
  budget: money("budget"),
  budgetCurrency: text("budget_currency"),
  referenceImageUrls: jsonb("reference_image_urls").$type<string[]>().notNull().default([]),
  destinationCountry: text("destination_country").notNull(),
  status: customRequestStatus("status").notNull().default("new"),
  quotePkr: money("quote_pkr"),
  quoteDays: integer("quote_days"),
  quoteMessage: text("quote_message"),
  quotedAt: timestamp("quoted_at", { withTimezone: true }),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const wholesaleApplications = pgTable("wholesale_applications", {
  id: id(),
  businessName: text("business_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  country: text("country").notNull(),
  website: text("website"),
  businessType: text("business_type").notNull(),
  expectedVolume: text("expected_volume"),
  message: text("message"),
  status: leadStatus("status").notNull().default("new"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const referralCodes = pgTable("referral_codes", {
  code: text("code").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  uses: integer("uses").notNull().default(0),
  createdAt: createdAt(),
});

export const referralRedemptions = pgTable("referral_redemptions", {
  id: id(),
  code: text("code").notNull(),
  referrerUserId: uuid("referrer_user_id").references(() => users.id, { onDelete: "set null" }),
  referredUserId: uuid("referred_user_id").references(() => users.id, { onDelete: "set null" }),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"), // pending | awarded | void
  createdAt: createdAt(),
});

export const loyaltyLedger = pgTable("loyalty_ledger", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  points: integer("points").notNull(),
  reason: text("reason").notNull(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

// ── Communication & operations ──────────────────────────────────────────────

export const conversations = pgTable("conversations", {
  id: id(),
  buyerId: uuid("buyer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  subject: text("subject").notNull(),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: createdAt(),
});

export const messages = pgTable("messages", {
  id: id(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  senderUserId: uuid("sender_user_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const contactMessages = pgTable("contact_messages", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  topic: text("topic").notNull(),
  orderNumber: text("order_number"),
  message: text("message").notNull(),
  status: ticketStatus("status").notNull().default("new"),
  assignedToId: uuid("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
  reply: text("reply"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: id(),
  email: text("email").notNull().unique(),
  source: text("source"),
  status: text("status").notNull().default("subscribed"),
  createdAt: createdAt(),
});

export const notifications = pgTable("notifications", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const emailOutbox = pgTable("email_outbox", {
  id: id(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  template: text("template"),
  status: text("status").notNull().default("queued"), // queued | sent | failed | logged
  error: text("error"),
  createdAt: createdAt(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    summary: text("summary").notNull(),
    data: jsonb("data"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_entity_idx").on(t.entity, t.entityId)],
);

export const adminNotes = pgTable("admin_notes", {
  id: id(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  body: text("body").notNull(),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

// ── Relations (for the relational query API) ────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  staffRole: one(staffRoles, { fields: [users.staffRoleId], references: [staffRoles.id] }),
  vendor: one(vendors, { fields: [users.id], references: [vendors.userId] }),
  addresses: many(addresses),
  orders: many(orders),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  user: one(users, { fields: [vendors.userId], references: [users.id] }),
  primaryCategory: one(categories, { fields: [vendors.primaryCategoryId], references: [categories.id] }),
  products: many(products),
  reviews: many(reviews),
  checks: many(verificationChecks),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  vendor: one(vendors, { fields: [products.vendorId], references: [vendors.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  images: many(productImages),
  reviews: many(reviews),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  product: one(products, { fields: [reviews.productId], references: [products.id] }),
  vendor: one(vendors, { fields: [reviews.vendorId], references: [vendors.id] }),
  photos: many(reviewPhotos),
}));

export const reviewPhotosRelations = relations(reviewPhotos, ({ one }) => ({
  review: one(reviews, { fields: [reviewPhotos.reviewId], references: [reviews.id] }),
}));

export const verificationChecksRelations = relations(verificationChecks, ({ one }) => ({
  vendor: one(vendors, { fields: [verificationChecks.vendorId], references: [vendors.id] }),
}));

export const cartsRelations = relations(carts, ({ many }) => ({
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  product: one(products, { fields: [cartItems.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  brandItems: many(brandOrderItems),
  brandFulfilments: many(brandFulfilments),
  vendorOrders: many(vendorOrders),
  events: many(orderEvents),
  payments: many(payments),
  refunds: many(refunds),
  disputes: many(disputes),
}));

export const vendorOrdersRelations = relations(vendorOrders, ({ one, many }) => ({
  order: one(orders, { fields: [vendorOrders.orderId], references: [orders.id] }),
  vendor: one(vendors, { fields: [vendorOrders.vendorId], references: [vendors.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  vendorOrder: one(vendorOrders, { fields: [orderItems.vendorOrderId], references: [vendorOrders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export const orderEventsRelations = relations(orderEvents, ({ one }) => ({
  order: one(orders, { fields: [orderEvents.orderId], references: [orders.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));

export const refundsRelations = relations(refunds, ({ one }) => ({
  order: one(orders, { fields: [refunds.orderId], references: [orders.id] }),
}));

export const disputesRelations = relations(disputes, ({ one, many }) => ({
  order: one(orders, { fields: [disputes.orderId], references: [orders.id] }),
  vendorOrder: one(vendorOrders, { fields: [disputes.vendorOrderId], references: [vendorOrders.id] }),
  messages: many(disputeMessages),
}));

export const disputeMessagesRelations = relations(disputeMessages, ({ one }) => ({
  dispute: one(disputes, { fields: [disputeMessages.disputeId], references: [disputes.id] }),
}));

export const collectionsRelations = relations(collections, ({ many }) => ({
  products: many(collectionProducts),
}));

export const collectionProductsRelations = relations(collectionProducts, ({ one }) => ({
  collection: one(collections, { fields: [collectionProducts.collectionId], references: [collections.id] }),
  product: one(products, { fields: [collectionProducts.productId], references: [products.id] }),
}));

export const dutyRatesRelations = relations(dutyRates, ({ one }) => ({
  category: one(categories, { fields: [dutyRates.categoryId], references: [categories.id] }),
}));

export const importRulesRelations = relations(importRules, ({ one }) => ({
  category: one(categories, { fields: [importRules.categoryId], references: [categories.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  buyer: one(users, { fields: [conversations.buyerId], references: [users.id] }),
  vendor: one(vendors, { fields: [conversations.vendorId], references: [vendors.id] }),
  product: one(products, { fields: [conversations.productId], references: [products.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}));

export const customRequestsRelations = relations(customRequests, ({ one }) => ({
  vendor: one(vendors, { fields: [customRequests.vendorId], references: [vendors.id] }),
  category: one(categories, { fields: [customRequests.categoryId], references: [categories.id] }),
  product: one(products, { fields: [customRequests.productId], references: [products.id] }),
}));

export const journalPostsRelations = relations(journalPosts, ({ one }) => ({
  category: one(categories, { fields: [journalPosts.categoryId], references: [categories.id] }),
}));

export const vendorApplicationsRelations = relations(vendorApplications, ({ one }) => ({
  category: one(categories, { fields: [vendorApplications.categoryId], references: [categories.id] }),
}));

export const payoutsRelations = relations(payouts, ({ one }) => ({
  vendor: one(vendors, { fields: [payouts.vendorId], references: [vendors.id] }),
}));

export const certificatesRelations = relations(certificates, ({ one }) => ({
  vendor: one(vendors, { fields: [certificates.vendorId], references: [vendors.id] }),
  product: one(products, { fields: [certificates.productId], references: [products.id] }),
}));

export const staffRolesRelations = relations(staffRoles, ({ many }) => ({
  users: many(users),
}));

export const brandsRelations = relations(brands, ({ one, many }) => ({
  source: one(brandSources, { fields: [brands.id], references: [brandSources.brandId] }),
  products: many(brandProducts),
  syncRuns: many(brandSyncRuns),
  permissionGrantedBy: one(users, { fields: [brands.permissionGrantedById], references: [users.id] }),
}));

export const brandSourcesRelations = relations(brandSources, ({ one }) => ({
  brand: one(brands, { fields: [brandSources.brandId], references: [brands.id] }),
}));

export const brandSyncRunsRelations = relations(brandSyncRuns, ({ one }) => ({
  brand: one(brands, { fields: [brandSyncRuns.brandId], references: [brands.id] }),
  triggeredBy: one(users, { fields: [brandSyncRuns.triggeredById], references: [users.id] }),
}));

export const brandProductsRelations = relations(brandProducts, ({ one, many }) => ({
  brand: one(brands, { fields: [brandProducts.brandId], references: [brands.id] }),
  images: many(brandProductImages),
  variants: many(brandProductVariants),
}));

export const brandProductImagesRelations = relations(brandProductImages, ({ one }) => ({
  product: one(brandProducts, { fields: [brandProductImages.productId], references: [brandProducts.id] }),
}));

export const brandProductVariantsRelations = relations(brandProductVariants, ({ one }) => ({
  product: one(brandProducts, { fields: [brandProductVariants.productId], references: [brandProducts.id] }),
}));

export const brandCartsRelations = relations(brandCarts, ({ many }) => ({
  items: many(brandCartItems),
}));

export const brandCartItemsRelations = relations(brandCartItems, ({ one }) => ({
  cart: one(brandCarts, { fields: [brandCartItems.cartId], references: [brandCarts.id] }),
  variant: one(brandProductVariants, { fields: [brandCartItems.variantId], references: [brandProductVariants.id] }),
}));

export const brandOrderItemsRelations = relations(brandOrderItems, ({ one }) => ({
  order: one(orders, { fields: [brandOrderItems.orderId], references: [orders.id] }),
  brand: one(brands, { fields: [brandOrderItems.brandId], references: [brands.id] }),
  product: one(brandProducts, { fields: [brandOrderItems.productId], references: [brandProducts.id] }),
}));

export const brandFulfilmentsRelations = relations(brandFulfilments, ({ one }) => ({
  order: one(orders, { fields: [brandFulfilments.orderId], references: [orders.id] }),
  brand: one(brands, { fields: [brandFulfilments.brandId], references: [brands.id] }),
}));
