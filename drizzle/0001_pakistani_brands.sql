CREATE TYPE "public"."brand_audience" AS ENUM('women', 'men', 'kids', 'unisex');--> statement-breakpoint
CREATE TYPE "public"."brand_fulfilment_status" AS ENUM('pending', 'ordered_from_brand', 'received_at_wahbayaan', 'quality_checked', 'dispatched', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."brand_partnership" AS ENUM('none', 'requested', 'authorised');--> statement-breakpoint
CREATE TYPE "public"."brand_product_status" AS ENUM('draft', 'published', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."brand_source_type" AS ENUM('shopify_json', 'csv_feed', 'manual');--> statement-breakpoint
CREATE TYPE "public"."brand_sync_status" AS ENUM('running', 'succeeded', 'partial', 'failed', 'refused');--> statement-breakpoint
CREATE TYPE "public"."order_kind" AS ENUM('artisan', 'brand');--> statement-breakpoint
CREATE TABLE "brand_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"user_id" uuid,
	"brand_id" uuid NOT NULL,
	"product_id" uuid,
	"kind" text NOT NULL,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_key" text NOT NULL,
	"ship_to" text DEFAULT 'home' NOT NULL,
	"is_gift" boolean DEFAULT false NOT NULL,
	"gift_message" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_carts_owner_key_unique" UNIQUE("owner_key")
);
--> statement-breakpoint
CREATE TABLE "brand_fulfilments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"brand_id" uuid,
	"brand_label" text NOT NULL,
	"status" "brand_fulfilment_status" DEFAULT 'pending' NOT NULL,
	"brand_order_ref" text,
	"purchase_cost_pkr" bigint,
	"courier" text,
	"tracking_number" text,
	"notes" text,
	"ordered_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"quality_checked_at" timestamp with time zone,
	"dispatched_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"brand_id" uuid,
	"product_id" uuid,
	"variant_id" uuid,
	"brand_name" text NOT NULL,
	"title" text NOT NULL,
	"size" text,
	"colour" text,
	"sku" text,
	"source_url" text,
	"image_url" text,
	"requested_url" text,
	"requested_domain" text,
	"buyer_note" text,
	"staff_note" text,
	"unavailable" boolean DEFAULT false NOT NULL,
	"weight_g" integer,
	"qty" integer NOT NULL,
	"unit_price_pkr" bigint,
	"unit_price" bigint
);
--> statement-breakpoint
CREATE TABLE "brand_product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"alt" text,
	"kind" "image_kind" DEFAULT 'photo' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"external_id" text,
	"sku" text,
	"size" text,
	"colour" text,
	"price_pkr" bigint,
	"compare_at_price_pkr" bigint,
	"stock_qty" integer,
	"available" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"external_id" text,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"audience" "brand_audience" DEFAULT 'women' NOT NULL,
	"category" text,
	"collection" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fabric" text,
	"source_url" text,
	"price_pkr" bigint NOT NULL,
	"compare_at_price_pkr" bigint,
	"price_override_pkr" bigint,
	"weight_g" integer,
	"hs_code" text,
	"status" "brand_product_status" DEFAULT 'draft' NOT NULL,
	"source_published_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"source_hash" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	CONSTRAINT "brand_products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "brand_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"type" "brand_source_type" DEFAULT 'manual' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sync_enabled" boolean DEFAULT false NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_sources_brand_id_unique" UNIQUE("brand_id")
);
--> statement-breakpoint
CREATE TABLE "brand_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"source_type" "brand_source_type" NOT NULL,
	"trigger" text NOT NULL,
	"status" "brand_sync_status" DEFAULT 'running' NOT NULL,
	"added" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"unchanged" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"marked_unavailable" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"triggered_by_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"website_url" text,
	"description" text,
	"audiences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"partnership" "brand_partnership" DEFAULT 'none' NOT NULL,
	"partnership_note" text,
	"permission_granted_at" timestamp with time zone,
	"permission_granted_by_id" uuid,
	"permission_note" text,
	"permission_evidence_url" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"size_guide" jsonb,
	"default_weight_g" integer,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	CONSTRAINT "brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "couriers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"domestic" boolean DEFAULT false NOT NULL,
	"international" boolean DEFAULT false NOT NULL,
	"tracking_url_template" text,
	"contact_notes" text,
	"contract_notes" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "couriers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "kind" "order_kind" DEFAULT 'artisan' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "service_fee_amount" bigint;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "service_fee_status" "line_status" DEFAULT 'not_applicable' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "brand_flow" text;--> statement-breakpoint
ALTER TABLE "shipping_rates" ADD COLUMN "courier_id" uuid;--> statement-breakpoint
ALTER TABLE "shipping_rates" ADD COLUMN "zone" text;--> statement-breakpoint
ALTER TABLE "brand_alerts" ADD CONSTRAINT "brand_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_alerts" ADD CONSTRAINT "brand_alerts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_alerts" ADD CONSTRAINT "brand_alerts_product_id_brand_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."brand_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_cart_items" ADD CONSTRAINT "brand_cart_items_cart_id_brand_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."brand_carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_cart_items" ADD CONSTRAINT "brand_cart_items_variant_id_brand_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."brand_product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_fulfilments" ADD CONSTRAINT "brand_fulfilments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_fulfilments" ADD CONSTRAINT "brand_fulfilments_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_order_items" ADD CONSTRAINT "brand_order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_order_items" ADD CONSTRAINT "brand_order_items_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_order_items" ADD CONSTRAINT "brand_order_items_product_id_brand_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."brand_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_order_items" ADD CONSTRAINT "brand_order_items_variant_id_brand_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."brand_product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_product_images" ADD CONSTRAINT "brand_product_images_product_id_brand_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."brand_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_product_variants" ADD CONSTRAINT "brand_product_variants_product_id_brand_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."brand_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_products" ADD CONSTRAINT "brand_products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_sources" ADD CONSTRAINT "brand_sources_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_sync_runs" ADD CONSTRAINT "brand_sync_runs_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_sync_runs" ADD CONSTRAINT "brand_sync_runs_triggered_by_id_users_id_fk" FOREIGN KEY ("triggered_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_permission_granted_by_id_users_id_fk" FOREIGN KEY ("permission_granted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brand_alerts_brand_idx" ON "brand_alerts" USING btree ("brand_id");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_cart_variant_idx" ON "brand_cart_items" USING btree ("cart_id","variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_fulfilment_order_brand_idx" ON "brand_fulfilments" USING btree ("order_id","brand_label");--> statement-breakpoint
CREATE INDEX "brand_variants_product_idx" ON "brand_product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "brand_products_brand_idx" ON "brand_products" USING btree ("brand_id");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_products_external_idx" ON "brand_products" USING btree ("brand_id","external_id");--> statement-breakpoint
CREATE INDEX "brand_sync_runs_brand_idx" ON "brand_sync_runs" USING btree ("brand_id");--> statement-breakpoint
ALTER TABLE "shipping_rates" ADD CONSTRAINT "shipping_rates_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE cascade ON UPDATE no action;