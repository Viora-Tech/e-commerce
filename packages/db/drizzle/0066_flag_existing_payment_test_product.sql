-- Stores that ran Place a test order before 0065 have an unflagged test product.
UPDATE "product" SET "is_system_test" = true WHERE "handle" = 'payment-test' AND "is_system_test" = false;
