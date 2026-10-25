-- Product extra fields a shopper can filter collection and search pages by (Search & Discovery filters).
ALTER TABLE "metafield_definition" ADD COLUMN "filterable" boolean DEFAULT false NOT NULL;
