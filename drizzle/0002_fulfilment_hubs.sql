CREATE TYPE "public"."fulfilment_mode" AS ENUM('direct', 'hub');--> statement-breakpoint
CREATE TYPE "public"."fulfilment_quote_status" AS ENUM('pending', 'approved', 'declined', 'paid', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."hub_parcel_status" AS ENUM('expected', 'in_transit', 'received', 'qc_passed', 'qc_failed', 'packed', 'shipped', 'returned_to_seller', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."hub_type" AS ENUM('origin', 'city', 'forwarder');--> statement-breakpoint
CREATE TYPE "public"."return_status" AS ENUM('requested', 'approved', 'rejected', 'in_transit', 'received', 'refunded', 'closed');--> statement-breakpoint
CREATE TYPE "public"."shipment_kind" AS ENUM('direct', 'consolidated', 'partial', 'forwarder_leg');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('draft', 'booked', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TABLE "fulfilment_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"note" text,
	"status" "fulfilment_quote_status" DEFAULT 'pending' NOT NULL,
	"payment_ref" text,
	"created_by_id" uuid,
	"responded_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_parcels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"hub_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"vendor_order_id" uuid,
	"brand_fulfilment_id" uuid,
	"sender_label" text NOT NULL,
	"sender_city" text,
	"status" "hub_parcel_status" DEFAULT 'expected' NOT NULL,
	"courier" text,
	"tracking_number" text,
	"tracking_url" text,
	"provider" text,
	"expected_by" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"received_by_id" uuid,
	"measured_weight_g" integer,
	"qc_notes" text,
	"qc_photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"qc_at" timestamp with time zone,
	"qc_by_id" uuid,
	"bin" text,
	"shipment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hub_parcels_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "hubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "hub_type" DEFAULT 'origin' NOT NULL,
	"city" text NOT NULL,
	"country" text DEFAULT 'PK' NOT NULL,
	"address" jsonb NOT NULL,
	"contact_name" text,
	"contact_phone" text,
	"contact_email" text,
	"receiving_hours" text,
	"cutoff_time" text,
	"handling_days" integer,
	"onward_courier_id" uuid,
	"consolidation_cadence" text,
	"notes" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_fulfilments" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"mode" "fulfilment_mode" NOT NULL,
	"hub_id" uuid,
	"one_delivery" boolean DEFAULT false NOT NULL,
	"estimated_dispatch_at" timestamp with time zone,
	"decision" text,
	"decision_note" text,
	"decision_at" timestamp with time zone,
	"decision_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid,
	"vendor_order_id" uuid,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reason" text NOT NULL,
	"description" text NOT NULL,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "return_status" DEFAULT 'requested' NOT NULL,
	"destination" text NOT NULL,
	"return_hub_id" uuid,
	"courier" text,
	"tracking_number" text,
	"refund_id" uuid,
	"staff_note" text,
	"decided_by_id" uuid,
	"decided_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "return_requests_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "shipment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"order_item_id" uuid,
	"brand_order_item_id" uuid,
	"hub_parcel_id" uuid,
	"qty" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" "shipment_kind" NOT NULL,
	"status" "shipment_status" DEFAULT 'draft' NOT NULL,
	"vendor_order_id" uuid,
	"from_hub_id" uuid,
	"to_hub_id" uuid,
	"courier_id" uuid,
	"courier_name" text,
	"service_name" text,
	"provider" text DEFAULT 'manual' NOT NULL,
	"booking_ref" text,
	"tracking_number" text,
	"tracking_url" text,
	"weight_g" integer,
	"length_cm" numeric,
	"width_cm" numeric,
	"height_cm" numeric,
	"volumetric_weight_g" integer,
	"chargeable_weight_g" integer,
	"rate_cost_pkr" bigint,
	"document_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_by_id" uuid,
	"booked_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
ALTER TABLE "fulfilment_quotes" ADD CONSTRAINT "fulfilment_quotes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfilment_quotes" ADD CONSTRAINT "fulfilment_quotes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_parcels" ADD CONSTRAINT "hub_parcels_hub_id_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."hubs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_parcels" ADD CONSTRAINT "hub_parcels_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_parcels" ADD CONSTRAINT "hub_parcels_vendor_order_id_vendor_orders_id_fk" FOREIGN KEY ("vendor_order_id") REFERENCES "public"."vendor_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_parcels" ADD CONSTRAINT "hub_parcels_brand_fulfilment_id_brand_fulfilments_id_fk" FOREIGN KEY ("brand_fulfilment_id") REFERENCES "public"."brand_fulfilments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_parcels" ADD CONSTRAINT "hub_parcels_received_by_id_users_id_fk" FOREIGN KEY ("received_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_parcels" ADD CONSTRAINT "hub_parcels_qc_by_id_users_id_fk" FOREIGN KEY ("qc_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hubs" ADD CONSTRAINT "hubs_onward_courier_id_couriers_id_fk" FOREIGN KEY ("onward_courier_id") REFERENCES "public"."couriers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_fulfilments" ADD CONSTRAINT "order_fulfilments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_fulfilments" ADD CONSTRAINT "order_fulfilments_hub_id_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."hubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_fulfilments" ADD CONSTRAINT "order_fulfilments_decision_by_id_users_id_fk" FOREIGN KEY ("decision_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_vendor_order_id_vendor_orders_id_fk" FOREIGN KEY ("vendor_order_id") REFERENCES "public"."vendor_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_return_hub_id_hubs_id_fk" FOREIGN KEY ("return_hub_id") REFERENCES "public"."hubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_brand_order_item_id_brand_order_items_id_fk" FOREIGN KEY ("brand_order_item_id") REFERENCES "public"."brand_order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_hub_parcel_id_hub_parcels_id_fk" FOREIGN KEY ("hub_parcel_id") REFERENCES "public"."hub_parcels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_vendor_order_id_vendor_orders_id_fk" FOREIGN KEY ("vendor_order_id") REFERENCES "public"."vendor_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_from_hub_id_hubs_id_fk" FOREIGN KEY ("from_hub_id") REFERENCES "public"."hubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_to_hub_id_hubs_id_fk" FOREIGN KEY ("to_hub_id") REFERENCES "public"."hubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hub_parcels_order_idx" ON "hub_parcels" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "hub_parcels_hub_status_idx" ON "hub_parcels" USING btree ("hub_id","status");--> statement-breakpoint
CREATE INDEX "return_requests_order_idx" ON "return_requests" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "shipments_order_idx" ON "shipments" USING btree ("order_id");