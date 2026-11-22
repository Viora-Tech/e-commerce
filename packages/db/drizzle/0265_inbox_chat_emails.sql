-- Inbox chat emails: the shopper's copy of a reply they missed or of the closed chat, and the
-- team's "chats waiting for a reply" email. `shopper_emailed_at` is when the shopper was last
-- emailed about a thread (the team side already has `unanswered_alerted_at`). Additive only.
ALTER TABLE "inbox_conversation" ADD COLUMN IF NOT EXISTS "shopper_emailed_at" timestamp with time zone;
--> statement-breakpoint
-- Stores with a chat that may need one of these emails (touched in the last day), for the
-- worker's sweep; the sweep then applies the exact rules per store under RLS. Ids only, same
-- pattern as stores_with_member_daily_summaries (0111).
CREATE OR REPLACE FUNCTION stores_with_inbox_chat_emails() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM inbox_conversation
  WHERE anonymised_at IS NULL
    AND ((status = 'open' AND last_message_at > now() - interval '1 day'
          AND ((last_sender = 'shopper' AND unread_staff > 0
                AND (unanswered_alerted_at IS NULL OR unanswered_alerted_at < last_message_at))
            OR (last_sender IN ('staff', 'ai') AND unread_shopper > 0
                AND (shopper_emailed_at IS NULL OR shopper_emailed_at < last_message_at))))
      OR (status = 'closed' AND closed_at > now() - interval '1 day'
          AND (shopper_emailed_at IS NULL OR shopper_emailed_at < last_message_at)));
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_inbox_chat_emails() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_inbox_chat_emails() TO app;
