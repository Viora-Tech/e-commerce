CREATE TABLE "web_vital" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"metric" text NOT NULL,
	"value" double precision NOT NULL,
	"device" text NOT NULL,
	"path" text DEFAULT '/' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "web_vital_metric" CHECK ("web_vital"."metric" in ('LCP','INP','CLS')),
	CONSTRAINT "web_vital_device" CHECK ("web_vital"."device" in ('mobile','desktop'))
);
--> statement-breakpoint
ALTER TABLE "web_vital" ADD CONSTRAINT "web_vital_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "web_vital_store_created" ON "web_vital" USING btree ("store_id","created_at");--> statement-breakpoint
SELECT apply_store_rls();
