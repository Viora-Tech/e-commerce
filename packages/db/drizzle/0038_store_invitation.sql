CREATE TABLE "store_invitation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"invitation_id" text NOT NULL,
	"email" text NOT NULL,
	"role_id" uuid NOT NULL,
	"invited_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_invitation" ADD CONSTRAINT "store_invitation_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_invitation" ADD CONSTRAINT "store_invitation_invitation_id_invitation_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_invitation" ADD CONSTRAINT "store_invitation_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "store_invitation_invitation" ON "store_invitation" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "store_invitation_store_email" ON "store_invitation" USING btree ("store_id","email");--> statement-breakpoint
SELECT apply_store_rls();
