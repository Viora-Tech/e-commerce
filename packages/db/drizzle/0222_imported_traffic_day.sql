-- #1121: daily sessions and visitors from the store's old platform (Shopify gives totals, not visits).
CREATE TABLE "imported_traffic_day" (
	"store_id" uuid NOT NULL,
	"day" date NOT NULL,
	"sessions" integer NOT NULL,
	"visitors" integer DEFAULT 0 NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "imported_traffic_day_store_id_day_pk" PRIMARY KEY("store_id","day")
);
--> statement-breakpoint
ALTER TABLE "imported_traffic_day" ADD CONSTRAINT "imported_traffic_day_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
SELECT apply_store_rls();
