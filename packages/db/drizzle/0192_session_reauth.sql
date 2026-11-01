ALTER TABLE "session" ADD COLUMN "reauthenticated_at" timestamp with time zone;--> statement-breakpoint
UPDATE "session" SET "reauthenticated_at" = "created_at";--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "reauthenticated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "reauthenticated_at" SET NOT NULL;
