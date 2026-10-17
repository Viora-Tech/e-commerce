CREATE TABLE "app_installation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"plugin_id" text NOT NULL,
	"installed_at" timestamp with time zone,
	"installed_by" text,
	"last_activity" text,
	"last_activity_at" timestamp with time zone,
	"last_error" text,
	"last_error_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "app_installation" ADD CONSTRAINT "app_installation_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_installation_store_plugin" ON "app_installation" USING btree ("store_id","plugin_id");--> statement-breakpoint
SELECT apply_store_rls();
