# Meta events no longer clear the page cache

Each sent event wrote `last_sent_at` on `pixel_connection`, and that table's trigger dropped the store's whole page cache. The trigger now fires only for columns a page can use, not for send bookkeeping.

Fixes #1190.
