# Replace from link keeps the old file (16 Nov 2026)

`media.replaceFromUrl` no longer deletes the old original. Store pages cached at the origin and at
Cloudflare keep linking it until the new photo is processed and the edge purge runs (the purge
waits for media processing to settle, so a batch of 50 photos means ~10 minutes); deleting it at
once showed broken photos on Waimers product pages during the 16 Nov photo swap. The old variant
files were already kept; the old original now joins them (one extra file per replaced photo).
