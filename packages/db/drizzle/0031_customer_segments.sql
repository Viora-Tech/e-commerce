CREATE TABLE IF NOT EXISTS "customer_segment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"rules" jsonb DEFAULT '{"match":"all","conditions":[]}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_segment" DROP CONSTRAINT IF EXISTS "customer_segment_store_id_store_id_fk";--> statement-breakpoint
ALTER TABLE "customer_segment" ADD CONSTRAINT "customer_segment_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_segment_store_name" ON "customer_segment" USING btree ("store_id","name");
--> statement-breakpoint
SELECT apply_store_rls();
