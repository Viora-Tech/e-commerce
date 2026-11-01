CREATE TABLE "preorder_campaign" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"ship_date" timestamp with time zone,
	"ships_in_days" integer,
	"limit" integer,
	"payment_mode" text DEFAULT 'full' NOT NULL,
	"deposit_paise" integer,
	"deposit_percent" integer,
	"discount_type" text DEFAULT 'none' NOT NULL,
	"discount_value" integer,
	"market_ids" uuid[] DEFAULT '{}' NOT NULL,
	"location_ids" uuid[] DEFAULT '{}' NOT NULL,
	"channels" text[] DEFAULT '{"online_store","social","ai_agents"}' NOT NULL,
	"mixed_cart" text DEFAULT 'split' NOT NULL,
	"sold_out_in_cart" text DEFAULT 'preorder' NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"design" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preorder_campaign_deposit_percent" CHECK ("preorder_campaign"."deposit_percent" is null or ("preorder_campaign"."deposit_percent" between 1 and 99)),
	CONSTRAINT "preorder_campaign_discount" CHECK ("preorder_campaign"."discount_value" is null or "preorder_campaign"."discount_value" >= 0)
);
--> statement-breakpoint
ALTER TABLE "cart_line" ADD COLUMN "preorder_campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "order_line" ADD COLUMN "preorder_campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "preorder_campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "preorder_own" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "preorder_campaign" ADD CONSTRAINT "preorder_campaign_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "preorder_campaign_store" ON "preorder_campaign" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "preorder_campaign_source" ON "preorder_campaign" USING btree ("store_id","source_id") WHERE "preorder_campaign"."source_id" is not null;--> statement-breakpoint
ALTER TABLE "cart_line" ADD CONSTRAINT "cart_line_preorder_campaign_id_preorder_campaign_id_fk" FOREIGN KEY ("preorder_campaign_id") REFERENCES "public"."preorder_campaign"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_preorder_campaign_id_preorder_campaign_id_fk" FOREIGN KEY ("preorder_campaign_id") REFERENCES "public"."preorder_campaign"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_preorder_campaign_id_preorder_campaign_id_fk" FOREIGN KEY ("preorder_campaign_id") REFERENCES "public"."preorder_campaign"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_line_preorder_campaign" ON "order_line" USING btree ("preorder_campaign_id") WHERE "order_line"."preorder_campaign_id" is not null;--> statement-breakpoint
CREATE INDEX "product_preorder_campaign" ON "product" USING btree ("preorder_campaign_id") WHERE "product"."preorder_campaign_id" is not null;--> statement-breakpoint
SELECT apply_store_rls();