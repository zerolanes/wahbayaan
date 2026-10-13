CREATE TABLE "affiliate_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"programme_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"product_url" text NOT NULL,
	"image_url" text,
	"price_pkr" bigint,
	"category" text,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"last_imported_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_programmes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"brand_name" text NOT NULL,
	"network" text,
	"terms_url" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"tracking_template" text,
	"feed_url" text,
	"display_allowed" boolean DEFAULT false NOT NULL,
	"display_allowed_at" timestamp with time zone,
	"display_allowed_by_id" uuid,
	"display_allowed_note" text,
	"last_import_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_directory_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"description" text,
	"website_url" text,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_directory_entries_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "brand_item_readiness" (
	"order_item_id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"ready_at" timestamp with time zone DEFAULT now() NOT NULL,
	"marked_by_id" uuid,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "brand_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_members_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "brand_profiles" (
	"brand_id" uuid PRIMARY KEY NOT NULL,
	"banner_url" text,
	"socials" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"self_listed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_seller_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"brand_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_role" text,
	"email" text NOT NULL,
	"phone" text,
	"website_url" text,
	"instagram" text,
	"city" text,
	"audiences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"product_types" text,
	"catalogue_size" text,
	"about" text,
	"status" "application_status" DEFAULT 'submitted' NOT NULL,
	"reviewer_id" uuid,
	"reviewer_notes" text,
	"brand_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "brand_terms_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid,
	"brand_id" uuid,
	"user_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"terms_version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text
);
--> statement-breakpoint
ALTER TABLE "affiliate_products" ADD CONSTRAINT "affiliate_products_programme_id_affiliate_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."affiliate_programmes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_programmes" ADD CONSTRAINT "affiliate_programmes_display_allowed_by_id_users_id_fk" FOREIGN KEY ("display_allowed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_collections" ADD CONSTRAINT "brand_collections_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_item_readiness" ADD CONSTRAINT "brand_item_readiness_order_item_id_brand_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."brand_order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_item_readiness" ADD CONSTRAINT "brand_item_readiness_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_item_readiness" ADD CONSTRAINT "brand_item_readiness_marked_by_id_users_id_fk" FOREIGN KEY ("marked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_members" ADD CONSTRAINT "brand_members_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_members" ADD CONSTRAINT "brand_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_seller_applications" ADD CONSTRAINT "brand_seller_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_seller_applications" ADD CONSTRAINT "brand_seller_applications_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_seller_applications" ADD CONSTRAINT "brand_seller_applications_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_terms_acceptances" ADD CONSTRAINT "brand_terms_acceptances_application_id_brand_seller_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."brand_seller_applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_terms_acceptances" ADD CONSTRAINT "brand_terms_acceptances_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_terms_acceptances" ADD CONSTRAINT "brand_terms_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_products_external_idx" ON "affiliate_products" USING btree ("programme_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_collections_name_idx" ON "brand_collections" USING btree ("brand_id","name");--> statement-breakpoint
CREATE INDEX "brand_terms_brand_idx" ON "brand_terms_acceptances" USING btree ("brand_id");