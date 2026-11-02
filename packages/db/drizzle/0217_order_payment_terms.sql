-- "Payment due later" on drafts (#1029): the terms an order was placed on and when it is due.
ALTER TABLE "order" ADD COLUMN "payment_terms" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "payment_due_at" timestamp with time zone;
