CREATE TABLE "analytics_page_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid NOT NULL,
	"path" text NOT NULL,
	"title" text,
	"referrer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consent_id" text NOT NULL,
	"visit_key" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"landing_path" text NOT NULL,
	"referrer" text,
	"country_code" text,
	"country" text,
	"region" text,
	"city" text,
	"latitude" double precision,
	"longitude" double precision,
	"device" text,
	"browser" text,
	"os" text,
	"screen" text,
	"language" text,
	"is_datacenter" boolean DEFAULT false NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "analytics_visits_visit_key_unique" UNIQUE("visit_key")
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consent_id" text NOT NULL,
	"decision" text NOT NULL,
	"categories" jsonb NOT NULL,
	"rev" integer NOT NULL,
	"ip_short" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ip_geo_cache" (
	"ip_hash" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_page_views" ADD CONSTRAINT "analytics_page_views_visit_id_analytics_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."analytics_visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_page_views_visit_idx" ON "analytics_page_views" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "analytics_page_views_created_idx" ON "analytics_page_views" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analytics_visits_last_seen_idx" ON "analytics_visits" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "analytics_visits_started_idx" ON "analytics_visits" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "analytics_visits_consent_idx" ON "analytics_visits" USING btree ("consent_id");--> statement-breakpoint
CREATE INDEX "consent_records_created_idx" ON "consent_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "consent_records_consent_idx" ON "consent_records" USING btree ("consent_id");