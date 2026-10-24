# Affiliates v1.1, PR 1: programs, own rates, order-value levels, exclusions

Branch `feat/affiliates-programs`, PR into `dev`. First of the seven "UpPromote parity for India"
PRs; design: `docs/superpowers/specs/2026-10-24-affiliates-parity-design.md` (copied in by this PR).
Owner calls on the open questions: invite-only auto-enrol, cash commission with a higher minimum
for the Customers program, 18% GST added to payouts for GST-registered affiliates (CA check), no
plan limits.

## Migration

`0163_affiliate_programs` (0160 pixels, 0161 inbox, 0162 platform routes; journal `when` last). New `affiliate_program` (id, store_id, name,
slug, is_default, rules jsonb, archived_at, timestamps; unique (store_id, slug); partial unique
(store_id) where is_default), `affiliate.program_id` (FK, nullable: null = default),
`affiliate.rate_override` jsonb, `affiliate_commission.program_id` (snapshot). Backfill: every store
with an `affiliates` entry or any affiliate gets one "Default" program whose `rules` is a copy of
the whole v1 entry; affiliates and commissions point at it. Guarded, so re-running adds nothing.
The program keys stay in the store entry, unread, so rolling the code back still works; remove
them one release later.

## Code

- `settings.ts`: `StoreAffiliateSettingsSchema` (active, cookieDays, holdDays, minPayoutPaise,
  tds) + `ProgramRulesSchema` (commission, overrides, new `excludes`, new `levels`, scope,
  lifetimeDays, approval, coupon, tiers, pitch, terms). `AffiliateSettingsSchema` is now the two
  merged (`withProgramRules`), the same shape as v1, so v1 callers and `flow.test.ts` are unchanged.
- `programs.ts` (new): `defaultProgram` (lazily made from the store entry for stores installed after
  the migration), `programOf`, `programBySlug`, `listPrograms`, `createProgram`, `saveProgram`,
  `archiveProgram` (moves affiliates), `restoreProgram`, `setAffiliateProgram` (coupon value
  follows), `setAffiliateRate`.
- `commission.ts`: precedence per line: excludes > product > collection > affiliate's own rate >
  order-value level > program default; a tier lifts whichever default percent wins.
  `orderValuePaise` (goods after discount, GST in) measures levels; `levelFor`, `defaultRuleFor`.
- `commissions.ts`: `creditOrder` takes the store settings and works the rest out under the
  matched affiliate's program; lifetime binding checks the bound affiliate's program scope.
  Commissions record `program_id`.
- `affiliates.ts`: `applyAsAffiliate` takes `programId`; `approveAffiliate` no longer takes settings
  (the coupon comes from the affiliate's program).
- `store-settings.ts`: `saveAffiliateSettings` saves store-wide keys only and keeps the rest of the
  entry.
- API (`routers/affiliates.ts`): `settings.get/save` are store-wide only; new `programs.list/get/
  create/save/archive/restore`, `setProgram`, `setRate`; `add` takes `programId`; `get` returns the
  program and the open programs; `list` adds `programName`. MCP: reads free, writes follow the
  approval switch (no new sensitive or excluded paths). `action-docs.generated.ts` regenerated.
- Admin: new Programs page (`programs-page.tsx`, `new-program-dialog.tsx`) and full-page editor
  `programs/[id]` (`program-editor.tsx`, `program-levels-card.tsx`, `program-excludes-card.tsx`,
  `commission-preview.tsx`, `archive-program-dialog.tsx`). Settings keeps store-wide fields only
  (link window moved here from the commission card). Affiliate detail: Program and rate card
  (`affiliate-program-card.tsx`). List: Program column. Add dialog: program select when there is
  more than one. Copy in `data/affiliates.ts` + `data/hi/affiliates.ts`.
- Storefront: `/affiliate?program=<slug>` shows that program's pitch, terms and code; applying joins
  it. A shopper who already joined always sees their own program.
- Manifest 1.1.0: Programs page; App Store catalogue regenerated.

## Tests

`packages/plugin-affiliates`: `flow.test.ts` and `rules.test.ts` unchanged and passing;
new `program-rules.test.ts` (split, precedence, levels incl. GST, tier x own rate) and
`programs.test.ts` (migration backfill run twice, default program from a v1 entry earns the same,
levels / own rate / move keeps old commissions and updates the coupon, lifetime by program,
archive and slugs).
