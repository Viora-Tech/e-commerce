CREATE TABLE "marketing_email_template" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"design" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marketing_campaign" ADD COLUMN "editor" text DEFAULT 'blocks' NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_campaign" ADD COLUMN "design" jsonb;--> statement-breakpoint
ALTER TABLE "marketing_email_template" ADD CONSTRAINT "marketing_email_template_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "marketing_email_template_store" ON "marketing_email_template" USING btree ("store_id","updated_at");--> statement-breakpoint
ALTER TABLE "marketing_campaign" ADD CONSTRAINT "marketing_campaign_editor" CHECK ("marketing_campaign"."editor" in ('blocks','visual'));
--> statement-breakpoint
SELECT apply_store_rls();
