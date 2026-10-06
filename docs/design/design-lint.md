# Design lint (@shadcn/lint)

`bun run lint:design` runs [@shadcn/lint](https://github.com/shadcn-ui/lint) through Oxlint over
`apps/admin/src`, `apps/storefront/src` and `packages/ui/src`. It checks how Tailwind is used
against our own components and theme, and every message explains the fix.

Biome stays the main linter (`bun run lint`). Oxlint here runs **only** the `shadcn/*` rules
(`categories.correctness` is off), so the two never overlap.

## Rules (all `warn` for now)

| Rule | Catches | Where |
| --- | --- | --- |
| `no-restyle` (layout allowed) | Pages changing a shared component's padding, size, shape or colour with `className` | admin, storefront (off inside `packages/ui`) |
| `no-raw-colors` | Colours that aren't theme tokens (`ring-neutral-200`) | admin, `packages/ui` |
| `no-unknown-classes` | Classes Tailwind can't generate | admin, `packages/ui` |
| `require-static-classes` | Class strings the linter can't read (`` `bg-${x}` ``) | everywhere |
| `no-inline-styles` | `style={{…}}` and `<style>` | everywhere |

Off on purpose:

- `no-arbitrary-values`: our convention is sizes in rem, which uses arbitrary values
  (`text-[0.625rem]`).
- `no-raw-colors` and `no-unknown-classes` on the storefront: imported Shopify themes and the
  storefront blocks use their own CSS class names (`text-small`, `btn__label`), which these rules
  would misread as Tailwind.

## Theme discovery

Each app has a `components.json` that points the linter at that app's theme
(`apps/admin`, `apps/storefront` → their `src/app/globals.css`; `packages/ui` → the admin
theme, which imports `@commerce/ui/styles.css`). Without them it picked the storefront theme for
every file and reported our admin size tokens (`text-body`) as colours.

## Baseline (2026-10-06)

1,525 warnings: `no-restyle` 1,369 (admin), `no-inline-styles` 82, `no-unknown-classes` 37,
`no-raw-colors` 18, `require-static-classes` 19. These are cleared during the admin UI revamp
(`docs/design/admin-ui-revamp-plan.md`); once a batch is clean its folder moves to `error`.
New code should add no new warnings.

Configure rules in `.oxlintrc.json`; rule docs: https://github.com/shadcn-ui/lint#rules and
examples in https://github.com/shadcn-ui/lint/blob/main/docs/design-systems.md.
