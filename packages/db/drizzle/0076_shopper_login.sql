CREATE TABLE "customer_identity" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "customer_identity_provider_check" CHECK ("customer_identity"."provider" in ('google', 'apple', 'facebook', 'truecaller'))
);
--> statement-breakpoint
CREATE TABLE "customer_login_ticket" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"customer_id" uuid,
	"return_url" text,
	"browser_hash" text,
	"next_path" text,
	"remember" boolean DEFAULT false NOT NULL,
	"provider" text,
	"subject" text,
	"email" text,
	"name" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_login_ticket_kind_check" CHECK ("customer_login_ticket"."kind" in ('handoff', 'truecaller', 'magic_link')),
	CONSTRAINT "customer_login_ticket_status_check" CHECK ("customer_login_ticket"."status" in ('pending', 'ready', 'verify_email', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "customer_passkey" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" text[] DEFAULT '{}' NOT NULL,
	"rp_id" text NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean DEFAULT false NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "login_providers" jsonb;--> statement-breakpoint
ALTER TABLE "customer_identity" ADD CONSTRAINT "customer_identity_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_identity" ADD CONSTRAINT "customer_identity_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_login_ticket" ADD CONSTRAINT "customer_login_ticket_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_login_ticket" ADD CONSTRAINT "customer_login_ticket_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_passkey" ADD CONSTRAINT "customer_passkey_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_passkey" ADD CONSTRAINT "customer_passkey_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_identity_store_provider_subject" ON "customer_identity" USING btree ("store_id","provider","subject");--> statement-breakpoint
CREATE INDEX "customer_identity_customer" ON "customer_identity" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_login_ticket_token" ON "customer_login_ticket" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "customer_login_ticket_expires" ON "customer_login_ticket" USING btree ("store_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_passkey_store_credential" ON "customer_passkey" USING btree ("store_id","credential_id");--> statement-breakpoint
CREATE INDEX "customer_passkey_customer" ON "customer_passkey" USING btree ("customer_id");--> statement-breakpoint
SELECT apply_store_rls();
