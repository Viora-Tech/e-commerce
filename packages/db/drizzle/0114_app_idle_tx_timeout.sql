-- Safety net: a session of the RLS app role that sits idle inside a transaction for 5 minutes is
-- ended by Postgres, releasing its connection and locks. On 2026-10-11 five media jobs hung on bucket
-- calls inside their transactions for 23 minutes and stopped the media queue; the calls now have hard
-- deadlines (storage-s3-compat), and this keeps any future hang from holding the database.
ALTER ROLE app SET idle_in_transaction_session_timeout = '5min';
