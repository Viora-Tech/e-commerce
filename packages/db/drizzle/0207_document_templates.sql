CREATE TABLE "document_template" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"html" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_template" ADD CONSTRAINT "document_template_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_template_kind" ON "document_template" USING btree ("store_id","kind");--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_updated_at ON "document_template";--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON "document_template" FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
