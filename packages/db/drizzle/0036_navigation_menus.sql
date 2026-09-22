CREATE TABLE IF NOT EXISTS "navigation_menu" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"title" text NOT NULL,
	"handle" text NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "navigation_menu" DROP CONSTRAINT IF EXISTS "navigation_menu_store_id_store_id_fk";--> statement-breakpoint
ALTER TABLE "navigation_menu" ADD CONSTRAINT "navigation_menu_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "navigation_menu_store_handle" ON "navigation_menu" USING btree ("store_id","handle");
--> statement-breakpoint
SELECT apply_store_rls();
