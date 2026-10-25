CREATE INDEX IF NOT EXISTS "inbox_message_store_sender" ON "inbox_message" USING btree ("store_id","sender","id");
