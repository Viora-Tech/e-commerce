CREATE TABLE IF NOT EXISTS "affiliate_blocklist" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"value_index" text NOT NULL,
	"hint" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "affiliate" ADD COLUMN IF NOT EXISTS "pan_index" text;--> statement-breakpoint
ALTER TABLE "affiliate" ADD COLUMN IF NOT EXISTS "payee_index" text;--> statement-breakpoint
ALTER TABLE "affiliate" ADD COLUMN IF NOT EXISTS "signup_ip_index" text;--> statement-breakpoint
ALTER TABLE "affiliate" ADD COLUMN IF NOT EXISTS "review_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_blocklist" ADD CONSTRAINT "affiliate_blocklist_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_blocklist_store_value" ON "affiliate_blocklist" USING btree ("store_id","kind","value_index");--> statement-breakpoint
SELECT apply_store_rls();
