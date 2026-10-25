CREATE TABLE "short_link" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"destination" text NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "short_link_slug_format" CHECK ("short_link"."slug" ~ '^[a-z0-9][a-z0-9-]{0,59}$')
);
--> statement-breakpoint
CREATE TABLE "short_link_click_day" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"link_id" uuid NOT NULL,
	"day" date NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "short_link" ADD CONSTRAINT "short_link_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_link_click_day" ADD CONSTRAINT "short_link_click_day_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_link_click_day" ADD CONSTRAINT "short_link_click_day_link_id_short_link_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."short_link"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "short_link_store_slug" ON "short_link" USING btree ("store_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "short_link_click_day_link_day" ON "short_link_click_day" USING btree ("link_id","day");
--> statement-breakpoint
SELECT apply_store_rls();