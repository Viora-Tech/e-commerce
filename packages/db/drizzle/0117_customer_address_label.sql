ALTER TABLE "customer_address" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "customer_address" ADD CONSTRAINT "customer_address_label_check" CHECK ("customer_address"."label" in ('home', 'office', 'other'));
