CREATE TABLE "contact_message" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"fields" text DEFAULT '{}' NOT NULL,
	"path" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_message" ADD CONSTRAINT "contact_message_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_message_store_created" ON "contact_message" USING btree ("store_id","created_at");--> statement-breakpoint
SELECT apply_store_rls();