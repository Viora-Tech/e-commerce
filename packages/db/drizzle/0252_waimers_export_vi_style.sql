-- One-time correction for Waimers (owner 16 Nov 2026): export invoices keep the store's own
-- style, VI/EXP/26-27/001, the numbers already on ShipGlobal's export papers and on earlier
-- invoices. The export series itself is switched in the store's settings (pattern VI/EXP/{FY}/,
-- 3 digits); this renames the three issued under the old pattern:
--   #2203 EXP/26-27/0001 -> VI/EXP/26-27/001, #2344 0002 -> 002, #2460 0003 -> 003.
-- Same guards as 0251: all three must still carry the numbers this expects, be issued and not in
-- a filed GSTR-1; anywhere else nothing changes. seq stays; the series counter stays at 4.
DO $$
DECLARE
  sid uuid := '259813c5-2ef9-0198-7fd0-e760f4273725';
  matched int;
BEGIN
  SELECT count(*) INTO matched FROM "invoice"
  WHERE "store_id" = sid AND "status" = 'issued' AND "reported_period" IS NULL AND (
    ("id" = '01a1e3a5-e297-73f5-9c89-0c41ad4f3933' AND "number" = 'EXP/26-27/0001') OR
    ("id" = '01a1e3a5-e2c0-7070-85da-b9afbcbcb496' AND "number" = 'EXP/26-27/0002') OR
    ("id" = '01a1c570-666f-7166-903d-bca71ec79ee5' AND "number" = 'EXP/26-27/0003'));
  IF matched <> 3 THEN
    RAISE NOTICE '0252: export VI style skipped (% of 3 rows match)', matched;
    RETURN;
  END IF;

  UPDATE "invoice" AS i SET
    "number" = v.num,
    "snapshot" = jsonb_set(i."snapshot", '{number}', to_jsonb(v.num)),
    "pdf_status" = 'pending',
    "pdf_error" = NULL,
    "updated_at" = now()
  FROM (VALUES
    ('01a1e3a5-e297-73f5-9c89-0c41ad4f3933'::uuid, 'VI/EXP/26-27/001'),
    ('01a1e3a5-e2c0-7070-85da-b9afbcbcb496'::uuid, 'VI/EXP/26-27/002'),
    ('01a1c570-666f-7166-903d-bca71ec79ee5'::uuid, 'VI/EXP/26-27/003')
  ) AS v(id, num)
  WHERE i."id" = v.id;
END $$;
