ALTER TABLE "order" ADD COLUMN "payment_adjustment_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "payment_adjustment_label" text;