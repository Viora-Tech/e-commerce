-- Discounts the Shopify importer saved before it set a type got the default `order`, even when they
-- apply to chosen products or collections or give free shipping. Give each the type its rules mean.
UPDATE "discount" SET "type" = 'shipping' WHERE "type" = 'order' AND "method" = 'free_shipping';
--> statement-breakpoint
UPDATE "discount" SET "type" = 'products' WHERE "type" = 'order' AND "applies_to" <> 'all';
