ALTER TABLE "ai_settings" DROP CONSTRAINT "ai_settings_plan_check";--> statement-breakpoint
ALTER TABLE "store_plan" ADD COLUMN "unlimited" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_plan_check" CHECK ("ai_settings"."plan" in ('free', 'starter', 'growth', 'pro', 'scale', 'internal'));