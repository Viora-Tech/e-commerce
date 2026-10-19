ALTER TABLE "ai_settings" DROP CONSTRAINT "ai_settings_plan_check";--> statement-breakpoint
-- The Pro plan's AI tier was called 'unlimited'; it has always been capped at 15,000 credits a month.
UPDATE "ai_settings" SET "plan" = 'pro' WHERE "plan" = 'unlimited';--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_plan_check" CHECK ("ai_settings"."plan" in ('free', 'starter', 'growth', 'pro'));
