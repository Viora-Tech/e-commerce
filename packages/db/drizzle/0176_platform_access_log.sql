-- Platform console access log: no store_id and deliberately no GRANT to the app role, so a
-- tenant request can neither read nor forge a row. Written and read on the owner connection.
CREATE TABLE "platform_access_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_user_id" text NOT NULL,
	"actor_email" text NOT NULL,
	"action" text NOT NULL,
	"store_id_ref" uuid,
	"target" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "platform_access_log_created" ON "platform_access_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "platform_access_log_store" ON "platform_access_log" USING btree ("store_id_ref","created_at");--> statement-breakpoint
CREATE INDEX "platform_access_log_actor" ON "platform_access_log" USING btree ("actor_email","created_at");
