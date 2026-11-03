-- #1064: more ways to reach a supplier (WhatsApp, WeChat, a second phone or email, website).
ALTER TABLE "supplier" ADD COLUMN "contacts" jsonb DEFAULT '[]'::jsonb NOT NULL;
