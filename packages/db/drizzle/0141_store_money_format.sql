-- How storefront prices read (Shopify money_format, e.g. "Rs. {{amount}}"); null keeps the currency format.
ALTER TABLE "store" ADD COLUMN "money_format" text;
