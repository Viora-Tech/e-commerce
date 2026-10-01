# CMS PR1: Content types in plain words, Hindi, presets

Branch `feat/cms-content-types` (based on `fix/security-owner-decisions`; merges after #218,
#219, #220). **No migration.** First of the five CMS PRs in the CMS upgrade plan.

- **Names**: merchants see "Content types" (metaobject definitions), "Entries" and "Extra
  fields" (metafields). Code, API (`metaobjects.*`), templates and developer docs keep
  Shopify's names. URLs are unchanged (`/content/metaobjects/...`). `docs/handoff.md` line
  "Sections still on empty states: Content (... metaobjects)" is stale: the Content types
  screens are built.
- **Presets**: one registry, `METAOBJECT_PRESETS` in `packages/core/src/metaobjects/presets.ts`
  (Size guide, FAQ, Team member, Store location, Testimonial, Lookbook), only the existing 12
  field types. `metaobjects.fromPreset` (content write permission) →
  `createDefinitionFromPreset`; the handle comes from the name, or the preset key when the name
  has no Latin letters (Hindi names). Card titles: `presetContent` in `apps/admin/src/data/metaobjects.ts`,
  typed `Record<PresetKey | 'blank', ...>`, so a new preset fails the typecheck until it has copy.
- **Guided flow**: `/content/metaobjects/new` is now the "What do you want to make?" chooser
  (`components/metaobjects/new-content-type.tsx`); the blank form moved to
  `/content/metaobjects/new/blank`.
- **Entry form**: Duplicate (copies the saved version as a draft), the save bar stays visible on
  new entries.
- **Hindi**: `data/hi/metaobjects.ts` covers every content screen and Settings → Custom data.
- `ChoiceCard` moved from `components/onboarding` to `components/layout` (shared, optional
  `description`).
- **Merchant guide**: `apps/docs/content/merchant-guide/selling/content.mdx`.

Left for PR2–PR5: richer field types (size table, colour, money, rating, list of entries),
Content list loops in Puck sections (per-product size guide through a product extra field),
more extra-field owners (customers, orders, variants), menus and redirects polish. The theme
editor's dynamic-source copy still says "metaobject entry" in a few merchant-guide lines of
`online-store.mdx`.
