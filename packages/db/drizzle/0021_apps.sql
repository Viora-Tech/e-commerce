ALTER TABLE "store" ADD COLUMN "apps" jsonb;--> statement-breakpoint
-- Stores that enabled a provider before plugins had to be installed keep it:
-- treat every enabled non-core provider id as an installed plugin of the same
-- id (adapter packages name their plugin after their provider).
UPDATE "store" SET "apps" = jsonb_build_object('installed', COALESCE((
  SELECT jsonb_agg(DISTINCT id) FROM (
    SELECT jsonb_array_elements_text(COALESCE("payments"->'enabled', '[]'::jsonb)) AS id
    UNION ALL
    SELECT jsonb_array_elements_text(COALESCE("shipping"->'enabled', '[]'::jsonb))
    UNION ALL
    SELECT jsonb_array_elements_text(COALESCE("notifications"->'enabled', '[]'::jsonb))
  ) ids WHERE id NOT IN ('cod', 'manual', 'fake', 'log')
), '[]'::jsonb))
WHERE "apps" IS NULL;
