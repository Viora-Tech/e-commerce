# Bucket calls get hard deadlines; idle transactions end after 5 minutes

Production, 2026-10-11: five media jobs hung on R2 calls inside their database transactions for 23
minutes (worker at 0.4% CPU, 1,857 images waiting). The SDK's `requestTimeout` is a socket idle timer
that Bun does not always honour, and a body that stalls mid-stream never trips it.

- `storage-s3-compat`: every bucket call (put, get incl. the body read, delete, head, list, batch delete)
  carries `AbortSignal.timeout(2 min)`, combined with the caller's signal where there is one. A hang now
  rejects and the job retries.
- Migration 0114: `ALTER ROLE app SET idle_in_transaction_session_timeout = '5min'` so no future hang can
  hold a connection and its locks.
