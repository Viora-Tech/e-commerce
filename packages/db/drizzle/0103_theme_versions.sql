CREATE TABLE "theme_version" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"theme_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"template" text NOT NULL,
	"suffix" text DEFAULT '' NOT NULL,
	"sections" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "theme_version_reason" CHECK ("theme_version"."reason" in ('publish','save'))
);
--> statement-breakpoint
ALTER TABLE "theme_version" ADD CONSTRAINT "theme_version_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_version" ADD CONSTRAINT "theme_version_theme_id_theme_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."theme"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "theme_version_theme" ON "theme_version" USING btree ("theme_id","template","suffix","created_at");--> statement-breakpoint
CREATE INDEX "theme_version_batch" ON "theme_version" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "theme_version_store" ON "theme_version" USING btree ("store_id");--> statement-breakpoint
SELECT apply_store_rls();