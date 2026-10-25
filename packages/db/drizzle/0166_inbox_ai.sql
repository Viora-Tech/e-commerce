ALTER TABLE "inbox_conversation" ADD COLUMN IF NOT EXISTS "needs_human" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "inbox_conversation" ADD COLUMN IF NOT EXISTS "handoff_summary" text;--> statement-breakpoint
ALTER TABLE "inbox_conversation" ADD COLUMN IF NOT EXISTS "handoff_at" timestamp with time zone;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inbox_ai_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid,
	"kind" text NOT NULL,
	"reason" text,
	"confidence" integer,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_ai_event_kind_check" CHECK ("inbox_ai_event"."kind" in ('answer', 'handoff'))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "inbox_ai_event" ADD CONSTRAINT "inbox_ai_event_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "inbox_ai_event" ADD CONSTRAINT "inbox_ai_event_conversation_id_inbox_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."inbox_conversation"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbox_ai_event_store_created" ON "inbox_ai_event" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inbox_ai_event_message" ON "inbox_ai_event" USING btree ("conversation_id","message_id");--> statement-breakpoint
SELECT apply_store_rls();
