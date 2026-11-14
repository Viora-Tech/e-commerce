# Design audit wave 2a: tokens, chips, empty states (14 Nov 2026)

Steps 3, 11 and 12 of the admin design audit (section 6.2). Branch `design/tokens-chips-empties`.

## Tokens (step 3)

- One red: `--destructive` is now an alias of `--danger` (light `#b91c1c`, dark `#f87171`), so
  error text, the destructive button and failed chips are the same red. The destructive glow
  follows it.
- One hairline grey: `--hairline` is an alias of `--border`.
- Radius tokens in rem (`calc(var(--radius) - 0.25rem)` etc.); same sizes as before.
- New type tokens: `text-micro` (0.6875rem / 1rem) for count pills, kbd hints and eyebrow labels;
  `text-section-title` (1.25rem / 1.75rem / 600), which billing and the app install step already
  used while it was undefined (they rendered at the inherited size and are now 1.25rem).
  Both are registered with tailwind-merge in `packages/ui/src/lib/utils.ts`.
- Arbitrary type sizes replaced with tokens (146 class strings in about 90 files): `text-[0.8125rem]` → `text-caption`
  (99; `font-normal` added where the class had no weight, because `text-caption` is 500),
  `text-[0.6875rem]` and `text-[0.625rem]` → `text-micro` (33), semibold `text-[0.9375rem]`
  titles → `text-card-title`, regular ones → `text-body`, `text-[1rem]` → `text-card-title`,
  `text-[1.25rem]`/`text-[1.125rem]` headings → `text-section-title`, the Delhivery tile figure →
  `text-stat`. Explicit `leading-*` stayed, so line boxes and layouts do not move.
- Left alone on purpose: the scaled-down checkout preview (`settings/checkout-branding-preview`),
  the SVG illustration text, the Home live-now hero figure (2.5rem), the score ring (2.25rem),
  the command palette input (1.0625rem), the text-size preview in Preferences, and the app page
  title in `apps/app-shell.tsx` (step 15 replaces that header with PageHeader).
- StatTile already used `text-stat` / `text-caption` (#1691).

## Chips (step 11)

- StatusChip gets `dot={false}` for plain labels and tags that are not a state.
- Every `Badge` in the admin (21 files) is now a StatusChip: states keep a dot and their tone;
  tags, keywords, scopes and labels like "Required" drop the dot; the AI plan label is `outline`.
- StatusLabel's dot variant renders StatusChip `variant="dot"` (keeps its caption/body size).
- The app page status pill (`apps/app-shell.tsx`) is a StatusChip `outline`; the app status chip
  next to the title lost its `h-5 text-xs` override.
- Not changed: `apps/installed/status-pills.tsx` are filter buttons (pressed state, counts), not
  status chips; they belong with the PillTabs work (step 14).

## Empty states (step 12)

- 127 ad-hoc empty `<p>` lines in about 120 files → `EmptyState variant="inline"`. Padding on the old
  line became margin on the row.
- Left as text: search/no-match lines inside pickers, menus, dropdown lists and the theme
  customizer chrome, dashed empty boxes, and lines that also show a loading message.
- `InlineState` and `PageState` lose their `empty` kind (the two callers moved to EmptyState),
  and the unused `states.empty` copy (English and Hindi) is gone.
- QueueEmpty already drew with EmptyState; nothing to change.

Tests: `components/layout/status-chip.test.tsx` (chip dot, StatusLabel dot, inline empty).
