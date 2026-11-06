-- How often the cookie banner was shown each day: a plain count, with no visitor or cookie, so the
-- store can see how many shoppers never answer it.
CREATE TABLE "cookie_banner_day" (
	"store_id" uuid NOT NULL,
	"day" date NOT NULL,
	"shown" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "cookie_banner_day_store_id_day_pk" PRIMARY KEY("store_id","day")
);
--> statement-breakpoint
ALTER TABLE "cookie_banner_day" ADD CONSTRAINT "cookie_banner_day_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
SELECT apply_store_rls();
