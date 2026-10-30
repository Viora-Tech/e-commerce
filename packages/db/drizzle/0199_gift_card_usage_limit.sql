ALTER TABLE "gift_card" ADD COLUMN "usage_limit" integer;--> statement-breakpoint
ALTER TABLE "gift_card" ADD COLUMN "use_count" integer DEFAULT 0 NOT NULL;