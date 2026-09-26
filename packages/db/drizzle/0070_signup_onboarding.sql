CREATE TABLE IF NOT EXISTS "signup_invite" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signup_invite_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "signup_invite_email_unused" ON "signup_invite" USING btree ("email") WHERE used_at is null;
--> statement-breakpoint
-- Platform-level, like the Better Auth tables in 0008_auth_grants.sql: no store_id, no RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "signup_invite" TO app;
--> statement-breakpoint
-- Lets the app role check whether a store slug is taken before any store
-- context exists, the same way resolve_store() answers hostname lookups.
CREATE OR REPLACE FUNCTION store_slug_taken(p_slug text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM store WHERE slug = lower(p_slug));
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION store_slug_taken(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION store_slug_taken(text) TO app;

