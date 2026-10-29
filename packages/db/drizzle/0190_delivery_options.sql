CREATE TABLE "delivery_option" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_route_rule" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_route_setting" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"key" text NOT NULL,
	"insures" boolean,
	"insurance_bps" integer,
	"insurance_min_paise" integer,
	"cost_card" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN "carrier" text;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "delivery_option" ADD CONSTRAINT "delivery_option_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_route_rule" ADD CONSTRAINT "delivery_route_rule_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_route_setting" ADD CONSTRAINT "delivery_route_setting_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_option_store" ON "delivery_option" USING btree ("store_id","position");--> statement-breakpoint
CREATE INDEX "delivery_route_rule_store" ON "delivery_route_rule" USING btree ("store_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_route_setting_key" ON "delivery_route_setting" USING btree ("store_id","key");--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_updated_at ON "delivery_option";--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON "delivery_option" FOR EACH ROW EXECUTE FUNCTION touch_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_updated_at ON "delivery_route_rule";--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON "delivery_route_rule" FOR EACH ROW EXECUTE FUNCTION touch_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_updated_at ON "delivery_route_setting";--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON "delivery_route_setting" FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
