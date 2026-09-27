ALTER TABLE "product" ADD COLUMN "category_id" text;--> statement-breakpoint
ALTER TABLE "variant" ADD COLUMN "box_preset_id" text;--> statement-breakpoint
ALTER TABLE "variant" ADD COLUMN "package_length_cm" integer;--> statement-breakpoint
ALTER TABLE "variant" ADD COLUMN "package_width_cm" integer;--> statement-breakpoint
ALTER TABLE "variant" ADD COLUMN "package_height_cm" integer;