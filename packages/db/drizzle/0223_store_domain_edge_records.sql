-- Records the edge provider (Cloudflare for SaaS) asks a merchant to add, per hostname. Null until
-- the provider has looked at the hostname; existing rows are left as they are.
ALTER TABLE "store_domain" ADD COLUMN "edge_records" jsonb;
