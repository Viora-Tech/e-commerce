-- One-time correction for Waimers (owner 16 Nov 2026): the FY 2026-27 export invoices go in the
-- order the parcels were handled, starting at 1 (the old system's VI/EXP/26-27/001 is a separate
-- series): #2203 -> EXP/26-27/0001, #2344 -> 0002, #2460 -> 0003, and the next export takes 0004.
-- Allowed because none of them is in a filed GSTR-1 yet (November is filed by 11 Dec).
--
-- Runs only on the exact rows it was written for: each invoice must still carry its old number,
-- be issued and unreported. Anywhere else (a fresh database, a test copy) it changes nothing.
-- The number lives in three places (number, seq, the printed snapshot); all three move together.
-- pdf_status goes back to pending, so the next download renders the PDF with the new number.
DO $$
DECLARE
  sid uuid := '259813c5-2ef9-0198-7fd0-e760f4273725';
  matched int;
BEGIN
  SELECT count(*) INTO matched FROM "invoice"
  WHERE "store_id" = sid AND "status" = 'issued' AND "reported_period" IS NULL AND (
    ("id" = '01a1e3a5-e297-73f5-9c89-0c41ad4f3933' AND "number" = 'EXP/26-27/0003') OR
    ("id" = '01a1e3a5-e2c0-7070-85da-b9afbcbcb496' AND "number" = 'EXP/26-27/0004') OR
    ("id" = '01a1c570-666f-7166-903d-bca71ec79ee5' AND "number" = 'EXP/26-27/0002'));
  IF matched <> 3 THEN
    RAISE NOTICE '0251: export renumber skipped (% of 3 rows match)', matched;
    RETURN;
  END IF;

  -- Park the numbers first: invoice_number_unique is not deferrable.
  UPDATE "invoice" SET "number" = "number" || '-renumbering'
  WHERE "id" IN ('01a1e3a5-e297-73f5-9c89-0c41ad4f3933', '01a1e3a5-e2c0-7070-85da-b9afbcbcb496',
                 '01a1c570-666f-7166-903d-bca71ec79ee5');

  UPDATE "invoice" AS i SET
    "number" = v.num,
    "seq" = v.seq,
    "snapshot" = jsonb_set(i."snapshot", '{number}', to_jsonb(v.num)),
    "pdf_status" = 'pending',
    "pdf_error" = NULL,
    "updated_at" = now()
  FROM (VALUES
    ('01a1e3a5-e297-73f5-9c89-0c41ad4f3933'::uuid, 'EXP/26-27/0001', 1),
    ('01a1e3a5-e2c0-7070-85da-b9afbcbcb496'::uuid, 'EXP/26-27/0002', 2),
    ('01a1c570-666f-7166-903d-bca71ec79ee5'::uuid, 'EXP/26-27/0003', 3)
  ) AS v(id, num, seq)
  WHERE i."id" = v.id;

  -- The export series' counter: 0004 is next (it stood at 5).
  UPDATE "invoice_sequence" AS q SET "next" = 4
  WHERE q."store_id" = sid AND q."fy_start_year" = 2026 AND q."next" = 5
    AND q."series_id" = (SELECT coalesce("series_id", '') FROM "invoice"
                         WHERE "id" = '01a1e3a5-e297-73f5-9c89-0c41ad4f3933');
END $$;
