CREATE TYPE "public"."outreach_event_kind" AS ENUM('email', 'replied', 'call_booked', 'phone_call', 'instagram_dm', 'whatsapp', 'note', 'status', 'unsubscribed');--> statement-breakpoint
CREATE TYPE "public"."outreach_status" AS ENUM('new', 'contacted', 'replied', 'call_booked', 'negotiating', 'agreed', 'declined', 'do_not_contact');--> statement-breakpoint
CREATE TABLE "outreach_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_name" text NOT NULL,
	"name_key" text NOT NULL,
	"contact_name" text,
	"brand_id" uuid,
	"directory_entry_id" uuid,
	"website_url" text,
	"email" text,
	"email_type" text,
	"phone" text,
	"instagram" text,
	"city" text,
	"category" text,
	"ships_internationally" text,
	"source_url" text,
	"notes" text,
	"owner_id" uuid,
	"status" "outreach_status" DEFAULT 'new' NOT NULL,
	"last_contacted_at" timestamp with time zone,
	"next_follow_up_at" timestamp with time zone,
	"source" text DEFAULT 'admin' NOT NULL,
	"staff_edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"kind" "outreach_event_kind" NOT NULL,
	"to_email" text,
	"subject" text,
	"body" text,
	"template_id" uuid,
	"outbox_id" uuid,
	"delivery_status" text,
	"from_status" text,
	"to_status" text,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"reason" text,
	"contact_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outreach_templates_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "reply_to" text;--> statement-breakpoint
ALTER TABLE "outreach_contacts" ADD CONSTRAINT "outreach_contacts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_contacts" ADD CONSTRAINT "outreach_contacts_directory_entry_id_brand_directory_entries_id_fk" FOREIGN KEY ("directory_entry_id") REFERENCES "public"."brand_directory_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_contacts" ADD CONSTRAINT "outreach_contacts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_contact_id_outreach_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."outreach_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_template_id_outreach_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."outreach_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_outbox_id_email_outbox_id_fk" FOREIGN KEY ("outbox_id") REFERENCES "public"."email_outbox"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_suppressions" ADD CONSTRAINT "outreach_suppressions_contact_id_outreach_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."outreach_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_templates" ADD CONSTRAINT "outreach_templates_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "outreach_contacts_name_key_idx" ON "outreach_contacts" USING btree ("name_key");--> statement-breakpoint
CREATE INDEX "outreach_contacts_status_idx" ON "outreach_contacts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "outreach_contacts_follow_up_idx" ON "outreach_contacts" USING btree ("next_follow_up_at");--> statement-breakpoint
CREATE INDEX "outreach_messages_contact_idx" ON "outreach_messages" USING btree ("contact_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "outreach_suppressions_email_idx" ON "outreach_suppressions" USING btree (lower("email"));