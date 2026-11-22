# SEO assistant: Search opportunities tab, Fix with AI drafts, weekly SEO email

Committed on `dev` (owner-approved 22 Nov 2026). Migration `0264_seo_weekly_snapshot`.

## What changed

- The Google Search Console connection already existed (app `google-search-console`: OAuth,
  encrypted refresh token in `store.apps.settings`, property matching `suggestProperty` with
  tests, daily worker sync of query+page rows into `search_console_row`, migration 0119). Reused
  as is. New env names `GOOGLE_SEARCH_CONSOLE_CLIENT_ID` / `_SECRET` (`searchConsoleOAuthApp`,
  `packages/plugin-search-console/src/google.ts`); the old `GSC_GOOGLE_*` still work. The scope
  stays `webmasters` (not `.readonly`): sitemap submit needs it.
- Online store → SEO now has tabs (`components/seo/seo-tabs.tsx`): Report and **Search
  opportunities** (`/online-store/seo/assistant`, `components/seo/seo-assistant-page.tsx`,
  `seo-opportunity-list.tsx`, `seo-opportunity-row.tsx`, `seo-fix-dialog.tsx`,
  `seo-draft-card.tsx`, `seo-assistant-empty.tsx`; copy `data/seo-assistant.ts` + Hindi).
- Ranking (`packages/core/src/seo/assistant/opportunity.ts`, subpath
  `@commerce/core/seo-assistant`): impressions × position weight (1 at 4, 0.6 at 15, 0.25 in the
  top 3, 0.2 to 30, 0.05 beyond), ×1.25 with a title/description gap. Gaps = SEO report issues.
- Fix with AI: `api.seo.assistantDraft` (`packages/api/src/services/ai/seo-assistant.ts`, prompt
  `packages/ai/src/seo-assistant/prompt.ts`) under the product writer's switch and allowance,
  model from `MODEL_TIERS`. Output clamped by `clampSeoDraft` (title ≤60, description ≤155,
  snippet ≤150 words). `api.seo.assistantApply` writes only approved title/description via
  `patchProductFields`, `updateCollection`, `updatePage`; needs `products.write` (products,
  collections) or `online_store.write` (pages). The snippet is copy only, never saved.
- Weekly SEO email `staff_seo_weekly` (composer `notifications/src/templates/compose/seo.ts`,
  copy `content-seo.ts`) to active owners, Monday from 9:00 IST, worker sweep `seo-weekly-email`
  (`apps/worker/src/seo-weekly.ts` → `sendSeoWeeklyEmail`). The week is claimed by a
  `seo_weekly_snapshot` row (unique store+week); moves compare with last week's snapshot, or the
  previous 28 days the first week. Off unless connected (`stores_with_search_console_connected()`);
  store switch in Settings → Notifications.

## Tests

- `packages/core/src/seo/assistant/{opportunity,apply,weekly}.test.ts` (scoring, limits, apply
  mapping, movers), `packages/ai/test/seo-assistant.test.ts` (prompt), property-matching tests
  already in `packages/plugin-search-console/test/settings.test.ts`; env alias case in
  `google.test.ts`. Run here, with notifications and notifications-whatsapp suites and tsc for
  db, notifications, notifications-whatsapp, ai, core, api, config, plugin-search-console, worker, admin.

## Left to do / for the owner to check

- `bun run db:migrate` (0264), then on localhost: Online store → SEO → Search opportunities with a
  connected store; Fix with AI on one row and a selection; Apply; check the product's SEO tab.
- Set `GOOGLE_SEARCH_CONSOLE_CLIENT_ID/SECRET` on admin and worker (or keep `GSC_GOOGLE_*`).
- Preview the email: Settings → Notifications → Weekly SEO email (owner).
