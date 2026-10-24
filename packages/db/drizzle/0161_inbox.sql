-- Inbox (our Shopify Inbox): conversations, messages, quick replies, blocks, and staff browser
-- push subscriptions. Design: docs/superpowers/specs/2026-10-24-inbox-design.md §3.
-- Idempotent, so a re-run (or a database that already has part of it) is a no-op.
CREATE TABLE IF NOT EXISTS "inbox_block" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"value_hash" text NOT NULL,
	"reason" text DEFAULT 'staff' NOT NULL,
	"conversation_id" uuid,
	"created_by" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_block_kind_check" CHECK ("inbox_block"."kind" in ('visitor', 'email', 'ip')),
	CONSTRAINT "inbox_block_reason_check" CHECK ("inbox_block"."reason" in ('spam', 'staff'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inbox_conversation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"channel" text DEFAULT 'web' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"blocked_reason" text,
	"customer_id" uuid,
	"visitor_key_hash" text,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"contact_phone_index" text,
	"contact_verified" boolean DEFAULT false NOT NULL,
	"assignee_user_id" text,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_preview" text,
	"last_sender" text,
	"unread_staff" integer DEFAULT 0 NOT NULL,
	"unread_shopper" integer DEFAULT 0 NOT NULL,
	"shopper_seen_message_id" uuid,
	"staff_seen_message_id" uuid,
	"first_response_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"closed_by" text,
	"started_url" text,
	"ip_hash" text,
	"unanswered_alerted_at" timestamp with time zone,
	"external_thread_id" text,
	"session_expires_at" timestamp with time zone,
	"attributed_order_id" uuid,
	"anonymised_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_conversation_channel_check" CHECK ("inbox_conversation"."channel" in ('web', 'whatsapp', 'instagram', 'messenger')),
	CONSTRAINT "inbox_conversation_status_check" CHECK ("inbox_conversation"."status" in ('open', 'closed', 'blocked')),
	CONSTRAINT "inbox_conversation_blocked_reason_check" CHECK ("inbox_conversation"."blocked_reason" is null or "inbox_conversation"."blocked_reason" in ('spam', 'staff')),
	CONSTRAINT "inbox_conversation_last_sender_check" CHECK ("inbox_conversation"."last_sender" is null or "inbox_conversation"."last_sender" in ('shopper', 'staff', 'system', 'ai'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inbox_message" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender" text NOT NULL,
	"member_user_id" text,
	"kind" text DEFAULT 'text' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"payload" jsonb,
	"client_id" text,
	"external_id" text,
	"delivery_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_message_sender_check" CHECK ("inbox_message"."sender" in ('shopper', 'staff', 'system', 'ai')),
	CONSTRAINT "inbox_message_kind_check" CHECK ("inbox_message"."kind" in ('text', 'product', 'discount', 'image', 'cart_event', 'note', 'system', 'template')),
	CONSTRAINT "inbox_message_body_length" CHECK (char_length("inbox_message"."body") <= 2000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inbox_quick_reply" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"shortcut" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_push_subscription" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"last_ok_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "inbox_block" ADD CONSTRAINT "inbox_block_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "inbox_block" ADD CONSTRAINT "inbox_block_conversation_id_inbox_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."inbox_conversation"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "inbox_conversation" ADD CONSTRAINT "inbox_conversation_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "inbox_conversation" ADD CONSTRAINT "inbox_conversation_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "inbox_message" ADD CONSTRAINT "inbox_message_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "inbox_message" ADD CONSTRAINT "inbox_message_conversation_id_inbox_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."inbox_conversation"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "inbox_quick_reply" ADD CONSTRAINT "inbox_quick_reply_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "member_push_subscription" ADD CONSTRAINT "member_push_subscription_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inbox_block_value" ON "inbox_block" USING btree ("store_id","kind","value_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbox_conversation_store_status_last" ON "inbox_conversation" USING btree ("store_id","status","last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbox_conversation_store_assignee" ON "inbox_conversation" USING btree ("store_id","assignee_user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbox_conversation_store_customer" ON "inbox_conversation" USING btree ("store_id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inbox_conversation_open_visitor" ON "inbox_conversation" USING btree ("store_id","visitor_key_hash") WHERE "inbox_conversation"."status" = 'open';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbox_message_conversation" ON "inbox_message" USING btree ("conversation_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inbox_message_client" ON "inbox_message" USING btree ("conversation_id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inbox_quick_reply_shortcut" ON "inbox_quick_reply" USING btree ("store_id","shortcut");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "member_push_subscription_endpoint" ON "member_push_subscription" USING btree ("store_id","endpoint");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_push_subscription_user" ON "member_push_subscription" USING btree ("store_id","user_id");
--> statement-breakpoint
-- The new `inbox` permission: system admins get all of it; any role that edits customers can
-- read and reply (design §7). Owners hold every permission implicitly.
INSERT INTO "role_permission" ("id", "store_id", "role_id", "permission")
SELECT gen_random_uuid(), r."store_id", r."id", p.permission
FROM "role" r
CROSS JOIN (VALUES ('inbox.read'), ('inbox.reply'), ('inbox.manage')) AS p(permission)
WHERE r."is_system" AND r."slug" = 'admin'
ON CONFLICT ("role_id", "permission") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permission" ("id", "store_id", "role_id", "permission")
SELECT gen_random_uuid(), r."store_id", r."id", p.permission
FROM "role" r
CROSS JOIN (VALUES ('inbox.read'), ('inbox.reply')) AS p(permission)
WHERE r."slug" <> 'owner' AND EXISTS (
  SELECT 1 FROM "role_permission" rp
  WHERE rp."role_id" = r."id" AND rp."permission" = 'customers.write'
)
ON CONFLICT ("role_id", "permission") DO NOTHING;
--> statement-breakpoint
SELECT apply_store_rls();
