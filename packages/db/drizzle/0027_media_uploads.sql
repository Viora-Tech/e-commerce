ALTER TABLE "media" ADD COLUMN "key" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "content_type" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "size" integer;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "status" text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "storage" jsonb;