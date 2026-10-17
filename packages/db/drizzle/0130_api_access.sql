CREATE TABLE "api_activity" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"grant_id" uuid,
	"kind" text NOT NULL,
	"tool" text,
	"summary" text NOT NULL,
	"detail" text,
	"ai_action_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_activity_kind" CHECK ("api_activity"."kind" in ('read','change','approval','blocked','connected','revoked','expired'))
);
--> statement-breakpoint
CREATE TABLE "api_auth_code" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"user_id" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"code_hash" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_challenge" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_grant" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"client_id" text,
	"user_id" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"hint" text NOT NULL,
	"access_hash" text NOT NULL,
	"access_expires_at" timestamp with time zone,
	"refresh_hash" text,
	"refresh_expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"last_ip" text,
	"revoked_at" timestamp with time zone,
	"revoked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_grant_kind" CHECK ("api_grant"."kind" in ('oauth','token'))
);
--> statement-breakpoint
CREATE TABLE "oauth_client" (
	"id" uuid PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"secret_hash" text,
	"name" text NOT NULL,
	"redirect_uris" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_client_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
ALTER TABLE "ai_action" DROP CONSTRAINT "ai_action_source_check";--> statement-breakpoint
ALTER TABLE "api_activity" ADD CONSTRAINT "api_activity_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_activity" ADD CONSTRAINT "api_activity_grant_id_api_grant_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."api_grant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_auth_code" ADD CONSTRAINT "api_auth_code_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_grant" ADD CONSTRAINT "api_grant_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_activity_store" ON "api_activity" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "api_auth_code_hash" ON "api_auth_code" USING btree ("code_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "api_grant_access" ON "api_grant" USING btree ("access_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "api_grant_refresh" ON "api_grant" USING btree ("refresh_hash");--> statement-breakpoint
CREATE INDEX "api_grant_store" ON "api_grant" USING btree ("store_id","created_at");--> statement-breakpoint
ALTER TABLE "ai_action" ADD CONSTRAINT "ai_action_source_check" CHECK ("ai_action"."source" in ('assistant', 'bulkWriter', 'mcp'));--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
-- OAuth clients register before anyone signs in, so they belong to no store.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "oauth_client" TO app;
--> statement-breakpoint
-- The store and grant behind an access token, before any store context exists (RLS hides it).
CREATE OR REPLACE FUNCTION api_grant_for_access(p_hash text) RETURNS TABLE(store_id uuid, grant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id, id FROM api_grant WHERE access_hash = p_hash AND revoked_at IS NULL;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION api_grant_for_access(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION api_grant_for_access(text) TO app;--> statement-breakpoint
-- The same for a refresh token (OAuth token endpoint).
CREATE OR REPLACE FUNCTION api_grant_for_refresh(p_hash text) RETURNS TABLE(store_id uuid, grant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id, id FROM api_grant WHERE refresh_hash = p_hash AND revoked_at IS NULL;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION api_grant_for_refresh(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION api_grant_for_refresh(text) TO app;--> statement-breakpoint
-- The store a one-time sign-in code was issued for.
CREATE OR REPLACE FUNCTION api_auth_code_store(p_hash text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM api_auth_code WHERE code_hash = p_hash;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION api_auth_code_store(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION api_auth_code_store(text) TO app;--> statement-breakpoint
-- The store an MCP address names (`/api/mcp/<slug>`).
CREATE OR REPLACE FUNCTION store_id_for_slug(p_slug text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM store WHERE slug = lower(p_slug);
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION store_id_for_slug(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION store_id_for_slug(text) TO app;
--> statement-breakpoint
-- Stores with MCP & API activity older than the 90 days the log keeps.
CREATE OR REPLACE FUNCTION stores_with_old_api_activity(at timestamptz DEFAULT now()) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM api_activity WHERE created_at < at - interval '90 days';
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_old_api_activity(timestamptz) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_old_api_activity(timestamptz) TO app;
