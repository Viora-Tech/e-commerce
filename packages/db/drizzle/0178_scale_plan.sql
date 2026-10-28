ALTER TABLE "ai_settings" DROP CONSTRAINT "ai_settings_plan_check";--> statement-breakpoint
ALTER TABLE "store_plan" DROP CONSTRAINT "store_plan_plan";--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_plan_check" CHECK ("ai_settings"."plan" in ('free', 'starter', 'growth', 'pro', 'scale'));--> statement-breakpoint
ALTER TABLE "store_plan" ADD CONSTRAINT "store_plan_plan" CHECK ("store_plan"."plan" in ('starter','growth','pro','scale'));