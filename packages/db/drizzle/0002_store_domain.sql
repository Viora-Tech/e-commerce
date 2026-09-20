CREATE TABLE "store_domain" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"hostname" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "store_domain_hostname_unique" UNIQUE("hostname")
);
--> statement-breakpoint
ALTER TABLE "store_domain" ADD CONSTRAINT "store_domain_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;