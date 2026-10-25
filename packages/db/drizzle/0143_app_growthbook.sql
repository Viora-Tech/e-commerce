-- The GrowthBook app's A/B test events (exposures and purchases), read by GrowthBook through a SQL data source.
CREATE TABLE "experiment_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"visitor_id" text NOT NULL,
	"kind" text NOT NULL,
	"experiment_key" text,
	"variation_id" integer,
	"order_id" uuid,
	"value_paise" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "experiment_event_kind" CHECK ("experiment_event"."kind" in ('exposure','purchase'))
);
--> statement-breakpoint
ALTER TABLE "experiment_event" ADD CONSTRAINT "experiment_event_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_event" ADD CONSTRAINT "experiment_event_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "experiment_event_exposure" ON "experiment_event" USING btree ("store_id","visitor_id","experiment_key","variation_id") WHERE kind = 'exposure';--> statement-breakpoint
CREATE UNIQUE INDEX "experiment_event_order" ON "experiment_event" USING btree ("order_id") WHERE kind = 'purchase';--> statement-breakpoint
CREATE INDEX "experiment_event_store_created" ON "experiment_event" USING btree ("store_id","created_at");--> statement-breakpoint
SELECT apply_store_rls();
