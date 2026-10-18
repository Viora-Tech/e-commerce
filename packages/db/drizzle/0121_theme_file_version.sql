CREATE TABLE "theme_file_version" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"theme_id" uuid NOT NULL,
	"path" text NOT NULL,
	"body" text NOT NULL,
	"reason" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "theme_file_version_reason" CHECK ("theme_file_version"."reason" in ('import','create','save'))
);
--> statement-breakpoint
ALTER TABLE "theme_file_version" ADD CONSTRAINT "theme_file_version_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_file_version" ADD CONSTRAINT "theme_file_version_theme_id_theme_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."theme"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "theme_file_version_file" ON "theme_file_version" USING btree ("theme_id","path","created_at");--> statement-breakpoint
CREATE INDEX "theme_file_version_store" ON "theme_file_version" USING btree ("store_id");--> statement-breakpoint
SELECT apply_store_rls();
