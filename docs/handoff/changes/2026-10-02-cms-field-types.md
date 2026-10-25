# CMS PR2: new field types for Content types and Extra fields

Branch `feat/cms-field-types` (from main 3e5278c7). **No migration**: the field type is plain
text in `metaobject_definition.fields` / `metafield_definition.type` (no `CHECK`), so the new
types only extend `FIELD_TYPES` (core) and `METAFIELD_TYPES` (`@commerce/db`, kept equal by a
test). Second of the five CMS PRs (plan: memory `cms-upgrade-plan`).

- **11 new types**, each with its stored shape in `packages/core/src/metaobjects/field-values.ts`
  and `schemas.ts`: `color` (`#rrggbb`), `date_time` (UTC ISO), `money`
  (`{ amount: paise, currency }`, INR/USD/EUR from `@commerce/money`), `choice` (from
  `validations.choices`; a list field is multi-pick), `link` (`{ label, url }`), `rating`
  (`{ value, max }`, half stars, `ratingMax` 1–10), `measurement` (`{ value, unit }`,
  `validations.measure` weight/length/volume), `page_reference`, `variant_reference`,
  `article_reference`, `group` (rows, one level deep, `validations.subfields` of
  `GROUP_FIELD_TYPES`, max 12 row fields / 100 rows). Developer docs:
  `apps/docs/content/developer-docs/building/content-types.mdx`.
- **Type lock**: `updateDefinition` refuses changing a field's type / list flag / currency /
  unit kind / a row field's type while entries hold a value under that key
  (`field-changes.ts`, `storedFieldProblems`). A key removed earlier and added back is allowed
  only when the old values still fit. `metaobjects.definition` now returns `filled` (per-key
  counts) and the admin greys out **What goes in it** with the reason.
- **References**: `referenceProblems`, `referenceOptions` and the picker rows moved from
  `service.ts` to `references.ts` (service.ts was at its file-size cap) and gained `page`,
  `variant`, `article` kinds (`REFERENCE_KINDS`, router `metaobjects.references`). Storefront
  (`storefront.ts`) resolves pages (published only), variants (live, active product) and blog
  posts (`visibleNow`), and files inside group rows.
- **Dynamic sources**: binding path `metaobjects.<type>.<handle>.<field>` unchanged.
  `COMPATIBLE` now lets text show date and time (store time zone, carried as
  `SourceValues[path].timeZone`), choice, rating, measurement and money objects; link/url take
  button links and page/variant/blog post references; number takes rating; colour takes
  colour. Groups are not connectable yet (PR3 Content list loops). `applyBindings` moved to
  `dynamic-sources/resolve.ts` (same `@commerce/core/dynamic-sources` entry) so `format.ts`
  stays under 500 lines; its date text now goes through `formatInZone` (date-format sweep entry
  for `format.ts` removed).
- **Presets**: Size guide's "Measured in" is a `choice`, its rows a `group` (Size, Chest, Waist,
  Length); Testimonial's stars a `rating`.
- **Admin**: new inputs in `apps/admin/src/components/metaobjects/` (`colour-input`,
  `date-time-input`, `money-field-input` on the shared `MoneyInput`, `choice-input` (drop-down
  or tick boxes), `link-input`, `rating-input` (tap stars), `measurement-input`, `group-input`
  (row cards) and `group-fields-editor` (row fields in the field dialog)). Copy in
  `data/metaobjects.ts` (+ `currencyContent`, `measureContent`) with Hindi in
  `data/hi/metaobjects.ts`. Star icons added to `packages/ui/src/icons.tsx`
  (`StarIcon`, `StarHalfIcon`).
- **Sweeps**: no-orphans swaps `service.ts: referenceProblems` for
  `field-changes.ts: fieldChangeProblems` (exported for its unit test); hardcoded-colours lists
  `colour-input.tsx` (swatch picker).
- Credit: Payload CMS `array` field and Instatic repeater summary, ideas only
  (`THIRD_PARTY_NOTICES.md`).

## For the Shopify importer (parallel PR)

This PR does not touch `packages/plugin-shopify-import`. After both merge, the metafield
mapping can extend to: `color` → `color`; `date_time` → `date_time`; `money`
`{ amount: "5.99", currency_code }` → `money` `{ amount: 599, currency }` (use `parseRupees`
/ `toMinor`); `link` `{ text, url }` → `link` `{ label, url }`; `rating`
`{ value, scale_max }` → `rating` `{ value, max }` (`validations.ratingMax` = scale max, ≤ 10);
`weight` / `dimension` / `volume` `{ value, unit }` → `measurement` with `measure`
weight / length / volume (Shopify units outside `MEASURE_UNITS`, e.g. `cl`, `m3`, `us_gal`,
`yd`, need converting); `page_reference` / `variant_reference` → same name (map Shopify GIDs
to our ids); article references → `article_reference`; `list.single_line_text_field` with a
choices validation → `choice` list. Value checks: `validateFieldValue` in
`@commerce/core/metaobjects`.

## Tested

`packages/core` metaobjects + dynamic-sources suites (new `field-values.test.ts` pure,
`field-types.test.ts` DB-backed: every type saved, resolved on the storefront and bound, cross
store references refused, draft pages hidden, picker kinds, the type lock). Admin content type
editor, field dialog (group rows, measurement), entry form with every new input, new entry,
desktop and 390px phone, checked in headless Chromium against `commerce_cms2_dev`.

## Follow-ups

- PR3: Content list loops (bind a group's rows / list fields to repeating section blocks).
- Theme import's Liquid `metafield` drops still return blank values (`theme-import/drops.ts`);
  wire them to these shapes when metafields are imported.
- Extra-field owners beyond products/collections (customers, orders, variants) — PR plan.
