-- A store review (about the shop, not one product; Judge.me store reviews) has no product.
ALTER TABLE "review" ALTER COLUMN "product_id" DROP NOT NULL;
