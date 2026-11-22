-- Customer page › More actions › "Sign in as customer": a staff member opens the storefront as a
-- shopper. The hand-off is a `staff_sign_in` login ticket that remembers who asked, and the
-- session it starts records them (`impersonated_by`, the staff user id) and lasts an hour.
-- Additive: nullable columns and a wider check, so an older build keeps working mid-deploy.
ALTER TABLE "customer_session" ADD COLUMN IF NOT EXISTS "impersonated_by" text;--> statement-breakpoint
ALTER TABLE "customer_login_ticket" ADD COLUMN IF NOT EXISTS "impersonated_by" text;--> statement-breakpoint
ALTER TABLE "customer_login_ticket" DROP CONSTRAINT IF EXISTS "customer_login_ticket_kind_check";--> statement-breakpoint
ALTER TABLE "customer_login_ticket" ADD CONSTRAINT "customer_login_ticket_kind_check" CHECK ("customer_login_ticket"."kind" in ('handoff', 'truecaller', 'magic_link', 'passkey_register', 'passkey_login', 'staff_sign_in'));
