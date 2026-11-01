CREATE TABLE "media_folder" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "media_folder" ADD CONSTRAINT "media_folder_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_folder_store_name" ON "media_folder" USING btree ("store_id",lower("name"));--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_folder_id_media_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."media_folder"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_in_folder" ON "media" USING btree ("folder_id");
--> statement-breakpoint
-- Store-scoped row level security for the new media_folder table.
SELECT apply_store_rls();
