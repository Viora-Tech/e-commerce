-- Apps → WhatsApp → Messages lists one store's sends on one channel, newest first.
CREATE INDEX IF NOT EXISTS "notification_store_channel_created" ON "notification" USING btree ("store_id","channel","created_at");
