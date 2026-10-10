CREATE TABLE "saved_report" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"report_slug" text NOT NULL,
	"range" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_report" ADD CONSTRAINT "saved_report_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_report_store_created" ON "saved_report" USING btree ("store_id","created_at");
--> statement-breakpoint
SELECT apply_store_rls();