CREATE TABLE "collection" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"handle" text NOT NULL,
	"title" text NOT NULL,
	"description" jsonb,
	"image_media_id" uuid,
	"kind" text DEFAULT 'manual' NOT NULL,
	"rules" jsonb DEFAULT '{"match":"all","conditions":[]}'::jsonb NOT NULL,
	"sort_order" text DEFAULT 'manual' NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_product" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection" ADD CONSTRAINT "collection_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection" ADD CONSTRAINT "collection_image_media_id_media_id_fk" FOREIGN KEY ("image_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_product" ADD CONSTRAINT "collection_product_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_product" ADD CONSTRAINT "collection_product_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_product" ADD CONSTRAINT "collection_product_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "collection_store_handle" ON "collection" USING btree ("store_id","handle");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_product_unique" ON "collection_product" USING btree ("collection_id","product_id");
--> statement-breakpoint
SELECT apply_store_rls();
