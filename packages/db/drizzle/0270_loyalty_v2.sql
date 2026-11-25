-- Loyalty points v2 (docs/loyalty-v2-interfaces.md): VIP tiers and members, earning rules, a
-- rewards catalog with redemptions, referrals, bonus campaigns and the loyalty email queue.
-- Additive only: loyalty_entry gains nullable columns and a wider source check.
ALTER TABLE "loyalty_entry" DROP CONSTRAINT IF EXISTS "loyalty_entry_source_check";
--> statement-breakpoint
ALTER TABLE "loyalty_entry" ADD CONSTRAINT "loyalty_entry_source_check" CHECK ("loyalty_entry"."source" in ('order', 'review', 'birthday', 'adjustment', 'reversal', 'rule', 'redemption', 'redemption_refund', 'referral', 'expiry', 'import', 'reset'));
--> statement-breakpoint
ALTER TABLE "loyalty_entry" ADD COLUMN IF NOT EXISTS "rule_id" uuid;
--> statement-breakpoint
ALTER TABLE "loyalty_entry" ADD COLUMN IF NOT EXISTS "earn_key" text;
--> statement-breakpoint
ALTER TABLE "loyalty_entry" ADD COLUMN IF NOT EXISTS "redemption_id" uuid;
--> statement-breakpoint
ALTER TABLE "loyalty_entry" ADD COLUMN IF NOT EXISTS "referral_id" uuid;
--> statement-breakpoint
ALTER TABLE "loyalty_entry" ADD COLUMN IF NOT EXISTS "campaign_id" uuid;
--> statement-breakpoint
ALTER TABLE "loyalty_entry" ADD COLUMN IF NOT EXISTS "multiplier_bp" integer;
--> statement-breakpoint
ALTER TABLE "loyalty_entry" ADD COLUMN IF NOT EXISTS "bonus_points" integer;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_entry_earn_once" ON "loyalty_entry" USING btree ("store_id","customer_id","earn_key") WHERE "loyalty_entry"."earn_key" is not null;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_tier" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"threshold" integer DEFAULT 0 NOT NULL,
	"multiplier_bp" integer DEFAULT 10000 NOT NULL,
	"perks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reward_id" uuid,
	"customer_tag" text,
	"colors" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_tier_threshold_check" CHECK ("loyalty_tier"."threshold" >= 0),
	CONSTRAINT "loyalty_tier_multiplier_check" CHECK ("loyalty_tier"."multiplier_bp" between 0 and 100000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_member" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"tier_id" uuid,
	"tier_changed_at" timestamp with time zone,
	"referral_code" text NOT NULL,
	"referred_by_id" uuid,
	"last_visit_day" text,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"tier_checked_day" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_tier_change" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"from_tier_id" uuid,
	"to_tier_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_earn_rule" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"type" text NOT NULL,
	"key" text DEFAULT '' NOT NULL,
	"title" text,
	"points" integer DEFAULT 0 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_earn_rule_points_check" CHECK ("loyalty_earn_rule"."points" between 0 and 1000000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_reward" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"points_cost" integer NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"min_points" integer,
	"max_points" integer,
	"product_id" uuid,
	"variant_id" uuid,
	"min_order_paise" integer,
	"min_tier_id" uuid,
	"usage_limit" integer,
	"once_per_customer" boolean DEFAULT false NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"code_days" integer,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_reward_cost_check" CHECK ("loyalty_reward"."points_cost" >= 0),
	CONSTRAINT "loyalty_reward_value_check" CHECK ("loyalty_reward"."value" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_redemption" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"reward_id" uuid,
	"reward_type" text NOT NULL,
	"title" text NOT NULL,
	"points" integer NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"discount_id" uuid,
	"code" text,
	"store_credit_entry_id" uuid,
	"status" text DEFAULT 'issued' NOT NULL,
	"order_id" uuid,
	"via" text DEFAULT 'redeem' NOT NULL,
	"expires_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_redemption_points_check" CHECK ("loyalty_redemption"."points" >= 0),
	CONSTRAINT "loyalty_redemption_status_check" CHECK ("loyalty_redemption"."status" in ('issued', 'used', 'cancelled', 'expired'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_referral" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"referrer_id" uuid NOT NULL,
	"friend_id" uuid NOT NULL,
	"code" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reject_reason" text,
	"device_id" text,
	"friend_order_id" uuid,
	"friend_redemption_id" uuid,
	"referrer_redemption_id" uuid,
	"available_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_referral_status_check" CHECK ("loyalty_referral"."status" in ('pending', 'friend_ordered', 'completed', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_campaign" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"tier_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bonus_type" text NOT NULL,
	"multiplier_bp" integer DEFAULT 10000 NOT NULL,
	"bonus_points" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_campaign_window_check" CHECK ("loyalty_campaign"."ends_at" > "loyalty_campaign"."starts_at")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_notification" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"template" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loyalty_tier" ADD CONSTRAINT "loyalty_tier_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_tier_store" ON "loyalty_tier" USING btree ("store_id","position");
--> statement-breakpoint
ALTER TABLE "loyalty_member" ADD CONSTRAINT "loyalty_member_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loyalty_member" ADD CONSTRAINT "loyalty_member_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loyalty_member" ADD CONSTRAINT "loyalty_member_tier_id_loyalty_tier_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."loyalty_tier"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loyalty_member" ADD CONSTRAINT "loyalty_member_referred_by_id_customer_id_fk" FOREIGN KEY ("referred_by_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_member_customer" ON "loyalty_member" USING btree ("store_id","customer_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_member_referral_code" ON "loyalty_member" USING btree ("store_id","referral_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_member_tier" ON "loyalty_member" USING btree ("store_id","tier_id");
--> statement-breakpoint
ALTER TABLE "loyalty_tier_change" ADD CONSTRAINT "loyalty_tier_change_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loyalty_tier_change" ADD CONSTRAINT "loyalty_tier_change_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loyalty_tier_change" ADD CONSTRAINT "loyalty_tier_change_from_tier_id_loyalty_tier_id_fk" FOREIGN KEY ("from_tier_id") REFERENCES "public"."loyalty_tier"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loyalty_tier_change" ADD CONSTRAINT "loyalty_tier_change_to_tier_id_loyalty_tier_id_fk" FOREIGN KEY ("to_tier_id") REFERENCES "public"."loyalty_tier"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_tier_change_store" ON "loyalty_tier_change" USING btree ("store_id","created_at");
--> statement-breakpoint
ALTER TABLE "loyalty_earn_rule" ADD CONSTRAINT "loyalty_earn_rule_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_earn_rule_type_key" ON "loyalty_earn_rule" USING btree ("store_id","type","key");
--> statement-breakpoint
ALTER TABLE "loyalty_reward" ADD CONSTRAINT "loyalty_reward_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loyalty_reward" ADD CONSTRAINT "loyalty_reward_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loyalty_reward" ADD CONSTRAINT "loyalty_reward_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loyalty_reward" ADD CONSTRAINT "loyalty_reward_min_tier_id_loyalty_tier_id_fk" FOREIGN KEY ("min_tier_id") REFERENCES "public"."loyalty_tier"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_reward_store" ON "loyalty_reward" USING btree ("store_id","position");
--> statement-breakpoint
ALTER TABLE "loyalty_redemption" ADD CONSTRAINT "loyalty_redemption_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loyalty_redemption" ADD CONSTRAINT "loyalty_redemption_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loyalty_redemption" ADD CONSTRAINT "loyalty_redemption_reward_id_loyalty_reward_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."loyalty_reward"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loyalty_redemption" ADD CONSTRAINT "loyalty_redemption_discount_id_discount_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discount"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loyalty_redemption" ADD CONSTRAINT "loyalty_redemption_store_credit_entry_id_store_credit_entry_id_fk" FOREIGN KEY ("store_credit_entry_id") REFERENCES "public"."store_credit_entry"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loyalty_redemption" ADD CONSTRAINT "loyalty_redemption_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_redemption_customer" ON "loyalty_redemption" USING btree ("store_id","customer_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_redemption_reward" ON "loyalty_redemption" USING btree ("store_id","reward_id","customer_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_redemption_discount" ON "loyalty_redemption" USING btree ("discount_id");
--> statement-breakpoint
ALTER TABLE "loyalty_referral" ADD CONSTRAINT "loyalty_referral_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loyalty_referral" ADD CONSTRAINT "loyalty_referral_referrer_id_customer_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loyalty_referral" ADD CONSTRAINT "loyalty_referral_friend_id_customer_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loyalty_referral" ADD CONSTRAINT "loyalty_referral_friend_order_id_order_id_fk" FOREIGN KEY ("friend_order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_referral_friend" ON "loyalty_referral" USING btree ("store_id","friend_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_referral_referrer" ON "loyalty_referral" USING btree ("store_id","referrer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_referral_due" ON "loyalty_referral" USING btree ("store_id","status","available_at");
--> statement-breakpoint
ALTER TABLE "loyalty_campaign" ADD CONSTRAINT "loyalty_campaign_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_campaign_window" ON "loyalty_campaign" USING btree ("store_id","starts_at","ends_at");
--> statement-breakpoint
ALTER TABLE "loyalty_notification" ADD CONSTRAINT "loyalty_notification_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loyalty_notification" ADD CONSTRAINT "loyalty_notification_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_notification_once" ON "loyalty_notification" USING btree ("store_id","customer_id","dedupe_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_notification_unsent" ON "loyalty_notification" USING btree ("store_id","sent_at");
--> statement-breakpoint
-- Customers who already hold v1 points become members (joined when they first earned). A code
-- that collides is skipped; that member is made on their next points change instead.
INSERT INTO "loyalty_member" ("id", "store_id", "customer_id", "referral_code", "joined_at")
SELECT gen_random_uuid(), "store_id", "customer_id", upper(substr(md5(random()::text || "customer_id"::text), 1, 8)), min("created_at")
FROM "loyalty_entry" GROUP BY "store_id", "customer_id"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
SELECT apply_store_rls();
