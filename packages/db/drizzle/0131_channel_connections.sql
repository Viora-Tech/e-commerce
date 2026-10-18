CREATE TABLE "channel_connection" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"account_id" text,
	"account_name" text,
	"target" text,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_connection_provider_check" CHECK ("channel_connection"."provider" in ('meta','google','openai'))
);
--> statement-breakpoint
CREATE TABLE "channel_listing" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"item_id" text NOT NULL,
	"hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_connection" ADD CONSTRAINT "channel_connection_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_listing" ADD CONSTRAINT "channel_listing_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_connection_provider" ON "channel_connection" USING btree ("store_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_listing_item" ON "channel_listing" USING btree ("store_id","provider","item_id");--> statement-breakpoint
CREATE INDEX "channel_listing_store" ON "channel_listing" USING btree ("store_id","provider");--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
-- Stores with a live platform connection, for the channel sync sweep.
CREATE OR REPLACE FUNCTION stores_with_channel_connections() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM channel_connection;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_channel_connections() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_channel_connections() TO app;
