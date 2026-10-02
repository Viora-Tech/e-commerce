CREATE TABLE "ai_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"plan" text DEFAULT 'starter' NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_settings_plan_check" CHECK ("ai_settings"."plan" in ('free', 'starter', 'growth', 'unlimited'))
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"month" text NOT NULL,
	"feature" text NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_settings_store" ON "ai_settings" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_store_month_feature" ON "ai_usage" USING btree ("store_id","month","feature");--> statement-breakpoint
-- Both tables are per store: forced RLS with the store_isolation policy, like every tenant table.
SELECT apply_store_rls();
