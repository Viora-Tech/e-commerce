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

First run: 1,525 warnings. After `chore/design-lint-fixes`: **124** (`no-restyle` 115,
`no-raw-colors` 8, `no-unknown-classes` 1). No visual change: every replacement renders the same
classes.

| Rule | Before | After | How |
| --- | --- | --- | --- |
| `no-unknown-classes` | 37 | 1 | Allow list in `.oxlintrc.json`: `cn-*` and `toaster` are shadcn marker hooks that generate nothing by design; `page-width`, `h4`, `rte`, `rich-text-block` are imported-theme and rich-text CSS; `kit-form` is a marker on 7 forms that no CSS targets. Left: `text-page` (setup wizard) |
| `no-raw-colors` | 18 | 8 | The print page and the editor section overlay disable the rule with a reason comment. Left: `text-kit-card-title` (6 drafts cards), `text-heading`, `text-heading-3`: classes with no token behind them, so they render nothing today. Giving them a size would change the look, so the redesign decides |
| `require-static-classes` | 19 | 0 | Off for files whose classes come from named constants or maps (`FIELD_CONTROL`, `ALIGN`, `TONE_CLASS`); they are static, the linter just cannot follow the constant |
| `no-inline-styles` | 82 | 0 | 7 moved to CSS custom properties (`w-(--w)`, `bg-(color:--swatch)`, `grid-cols-(--cols)`); the rest are off per file: user- and theme-picked colours and fonts, dnd-kit transforms, injected `<style>` themes, chart config |
| `no-restyle` | 1,369 | 115 | Variants and contracts below |

### Variants (same classes, merged after the base like `className`)

- `<Card gap inset>`: `gap="none"` = `gap-0`, `gap={3|4|5}` = `gap-3|4|5`; `inset="none"` = `p-0`,
  `inset={4|5|6}` = `p-4|5|6`, `inset="y-none"` = `py-0`, `inset="y-10"` = `py-10`.
- `<AlertDialogAction tone="destructive">` = `bg-destructive text-destructive-foreground
  hover:bg-destructive/90 dark:bg-destructive dark:text-destructive-foreground
  dark:hover:bg-destructive/90`.

### Contracts (what pages may still pass, and why)

- `TableCell`, `TableHead`, `TableRow`: typography, spacing, colour, shape. Density and number
  alignment differ per table until the redesign has one data-table kit.
- `*Trigger` (Collapsible, DropdownMenu, Popover, Tooltip), `Collapsible`, `CollapsibleContent`:
  everything. Unstyled primitives that wrap the page's own element, so there is no design-system
  style to override.
- `CardHeader`, `CardContent`, `CardFooter`, `CardTitle`, `CardDescription`: spacing, typography,
  colour. Regions are laid out per card.
- `Input`, `Textarea`, `Label`, `Field*`: typography (`font-mono`, `tabular-nums`), spacing (icon
  padding `pl-9`), colour. Radius stays denied on Input.
- `Dialog*`, `AlertDialog*`, `Sheet*` regions, `Skeleton`, `ToggleGroup*`, `RadioGroup`, `Badge`,
  `Alert`, `Empty*`, `Spinner`, `PopoverContent`: see `.oxlintrc.json`.
- `Button`: colour, `gap-*`, `rounded-*` (muted and destructive icon buttons).

### Left for the admin revamp

`no-restyle` 115: Card combined with `rounded-*`, shadow or `motion-press` (about 65, the stat and
tile cards), Button padding and type overrides, ChartContainer animation classes, Sidebar and
Tabs overrides, DropdownMenuItem, Input and SelectTrigger radius. Each needs a real variant (tile
card, muted icon button) decided with the new look (`docs/design/admin-ui-revamp-plan.md`); once a
batch is clean its folder moves to `error`. New code should add no new warnings.

Configure rules in `.oxlintrc.json`; rule docs: https://github.com/shadcn-ui/lint#rules and
examples in https://github.com/shadcn-ui/lint/blob/main/docs/design-systems.md.
