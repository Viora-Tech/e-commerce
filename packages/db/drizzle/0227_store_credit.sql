-- Store credit: a real per-customer balance and a ledger line per change (staff add or remove,
-- an order paid with it, a refund to it), instead of a gift card code.
CREATE TABLE "store_credit_account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"balance_paise" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_credit_account_balance" CHECK ("store_credit_account"."balance_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "store_credit_entry" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"amount_paise" integer NOT NULL,
	"balance_after_paise" integer NOT NULL,
	"kind" text NOT NULL,
	"reason" text NOT NULL,
	"staff_user_id" text,
	"staff_email" text,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_credit_entry_nonzero" CHECK ("store_credit_entry"."amount_paise" <> 0),
	CONSTRAINT "store_credit_entry_kind_check" CHECK ("store_credit_entry"."kind" in ('adjustment', 'payment', 'refund'))
);
--> statement-breakpoint
ALTER TABLE "store_credit_account" ADD CONSTRAINT "store_credit_account_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_credit_account" ADD CONSTRAINT "store_credit_account_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_credit_entry" ADD CONSTRAINT "store_credit_entry_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_credit_entry" ADD CONSTRAINT "store_credit_entry_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_credit_entry" ADD CONSTRAINT "store_credit_entry_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "store_credit_account_customer" ON "store_credit_account" USING btree ("store_id","customer_id");--> statement-breakpoint
CREATE INDEX "store_credit_entry_customer" ON "store_credit_entry" USING btree ("customer_id","created_at");
--> statement-breakpoint
SELECT apply_store_rls();
