ALTER TABLE "store_domain" ADD COLUMN "route_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_domain" ADD COLUMN "route_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_domain" ADD CONSTRAINT "store_domain_route_status" CHECK ("store_domain"."route_status" in ('none', 'pending', 'ready', 'failed'));