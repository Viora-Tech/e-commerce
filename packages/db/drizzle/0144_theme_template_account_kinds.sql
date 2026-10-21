-- Theme templates for the shopper's account pages and the sign-in page (`account`, `login`).
ALTER TABLE "theme_template" DROP CONSTRAINT "theme_template_kind";--> statement-breakpoint
ALTER TABLE "theme_template" ADD CONSTRAINT "theme_template_kind" CHECK ("theme_template"."template" in ('home','product','collection','page','blog','article','cart','search','not_found','account','login','header','footer'));
