CREATE TABLE "inbox_knowledge" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"title" text NOT NULL,
	"answer" text NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"source_metaobject_id" uuid,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_knowledge_title_length" CHECK (char_length("inbox_knowledge"."title") <= 200),
	CONSTRAINT "inbox_knowledge_answer_length" CHECK (char_length("inbox_knowledge"."answer") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "inbox_conversation" ADD COLUMN "ai_paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inbox_knowledge" ADD CONSTRAINT "inbox_knowledge_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inbox_knowledge_store_position" ON "inbox_knowledge" USING btree ("store_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_knowledge_source" ON "inbox_knowledge" USING btree ("store_id","source_metaobject_id");--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_updated_at ON "inbox_knowledge";--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON "inbox_knowledge" FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
