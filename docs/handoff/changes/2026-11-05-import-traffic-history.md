# Importer: Shopify traffic history

Fixes #1121. A **Traffic history** card on the Shopify importer reads two years of daily sessions
and visitors through `shopifyqlQuery` (`packages/plugin-shopify-import/src/traffic.ts`) into the
new `imported_traffic_day` table (migration `0222`). `packages/api/src/services/sessions.ts` adds
those days to session counts, so Home and Analytics carry on from Shopify.

- Worker must deploy first: it runs the migration. Admin needs a new image.
- Needs `read_reports` and Level 2 customer data access. Never run against a live store before
  this PR, so the query itself is unproven until the first real click; a refusal or parse error
  shows in a toast.
- Left for later: sessions by source, device, country and landing page; the Marketing overview
  still reads only `marketing_session`.
