# Code conventions

## React component files

One file, one component. Every `.tsx` under `apps/*/src`, `packages/blocks/src`,
`packages/editor/src` and `packages/ui/src` (vendored `packages/ui/src/components/shadcn/**`
excepted) follows this order. `bun run lint:components` enforces it and runs as part of
`bun run lint`.

1. `'use client'` only when the file needs browser APIs, state or effects.
2. Imports.
3. `type XProps = { ... }`. Never `interface` (the one exception is `declare global { interface Window }`).
4. Pure helpers and constants at module scope. Nothing that does not close over props or
   state belongs inside the component.
5. Exactly one component, exported as `export default function ComponentName()`. Named
   exports of components are not allowed; named exports of types and helpers are fine. Small
   private sub-components may sit below the default one if they are not exported; anything
   another file needs gets its own sibling file.
6. Component body, in this order, each section headed by its comment (omit a comment only
   when that section is empty):
   - `// Hooks` (context and custom hooks, then `useState`, then refs, then `useEffect`)
   - `// Helpers` (arrow functions that need component scope)
   - `// Event handlers` (arrow functions named `handleX`)
   - `// Early returns` (`if (!data) return <Empty />`; a const the guard needs may sit just above it)
   - `// Render logic` (derived values the JSX uses)
   - a single render `return`
7. No `useCallback`, `useMemo` or `React.memo`. The React Compiler memoises.
8. Soft cap 300 lines, hard cap 500. Split into sibling files rather than growing.

Naming: files are kebab-case and named after the component (`order-status-cell.tsx` default-exports
`OrderStatusCell`); import with `import OrderStatusCell from './order-status-cell'`. Package
barrels re-export with `export { default as X } from './components/x'`. Copy lives in `data/<feature>.ts`, never inline,
and admin components read it through `useCopy(x)` (client) or `await getCopy(x)` (server) so it
follows the member's language (Hindi overlays live in `data/hi/`; developer docs, "Admin
languages"). Sizes are rem, never px.

### Example

```tsx
'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import { tagsContent as copy } from '@/data/tags'
import { api } from '@/lib/api-client'

type TagsCardProps = {
  orderId: string
  tags: string[]
  onChanged: () => void
}

const MAX_TAGS = 20

function normalise(tag: string): string {
  return tag.trim().toLowerCase()
}

export default function TagsCard({ orderId, tags, onChanged }: TagsCardProps) {
  // Hooks
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  // Helpers
  const persist = async (next: string[]) => {
    setSaving(true)
    try {
      await api.orders.setTags({ id: orderId, tags: next })
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  // Event handlers
  const handleAdd = async () => {
    const next = normalise(draft)
    if (!next || tags.includes(next)) return
    await persist([...tags, next])
    setDraft('')
    toast.success(copy.saved)
  }

  // Early returns
  if (tags.length >= MAX_TAGS) {
    return <p className="text-body text-muted-foreground">{copy.limit(MAX_TAGS)}</p>
  }

  // Render logic
  const canAdd = !saving && normalise(draft).length > 0

  return (
    <div className="flex gap-2">
      <input value={draft} onChange={(e) => setDraft(e.target.value)} disabled={saving} />
      <Button onClick={handleAdd} disabled={!canAdd}>
        {copy.add}
      </Button>
    </div>
  )
}
```

### What the checker reports

| Rule | Message |
| --- | --- |
| `interface` outside `declare global` | `interface "X": use type` |
| Component as a named export | `component "X" is a named export: use export default` |
| Second default-exported component | `second default-exported component "X": one component per file` |
| `function name()` inside a component | `nested function "name" in X: use a module-scope helper or an arrow` |
| `function handleX()` inside a component | `handler "handleX" must be an arrow function` |
| Statement out of phase | `"x" belongs in hooks but appears after helpers and handlers in X` |
| Second full `return` | `X has more than one top-level return` |
| `useCallback` / `useMemo` / `memo(` | `useX() is banned (React Compiler handles memoisation)` |
| No section comments in a component with hooks or arrows | warning |
| Over 500 lines | error; over 300 lines: warning |
| `'use client'` file (`.tsx` or `.ts`) importing or re-exporting a value from `@commerce/core` or `@commerce/db` | `'use client' module imports values from "@commerce/core", which pulls the database driver into the browser` |

### Client modules and the server barrels

`@commerce/core` and `@commerce/db` are server barrels: their root entry pulls in Drizzle and
postgres. A `'use client'` module that imports a value from either drags a database driver into
the browser bundle, which fails the build (it happened four times before this rule). In client
code, import types from the barrels (`import type { X }` or `import { type X }`) and import values
from the pure subpaths that exist for this: `@commerce/core/catalog`, `/permissions`,
`/segments`, `/navigation`, `/adjustments`, `/emi` and so on. If the value you need has no pure
subpath yet, move it into one rather than importing the barrel.

## Storefront theme CSS (the Glide port exception)

New code uses Tailwind. The one exception is `packages/blocks/src/styles/`: the storefront
sections are ports of our own Shopify theme (Glide, the owner's `Shopify/theme` repo), and their BEM
stylesheets are ported alongside them (`section-<name>.css`, imported by `styles/index.css`) so
the rebuild stays pixel-faithful and a theme change can be diffed against the original file.
Those files still follow the other rules: rem sizes, colours from the theme's CSS variables,
never hardcoded. Inventory and status of the port: `docs/design/glide-theme-port.md`.

## Motion

One motion system for the admin and the storefront, after Emil Kowalski's rules (the
`emil-design-eng`, `review-animations` and `mobile-native` skills). The tokens are defined twice,
once per app, with the same values:

- Admin: `packages/ui/src/styles.css` (`@theme` curves, `:root` durations, the `motion-*` utilities).
- Storefront: `packages/blocks/src/styles/base.css` (`:root`, top of the file).

| Token | Value | Use |
| --- | --- | --- |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | anything entering or leaving, presses |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | something moving across the screen |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | sheets and drawers |
| `--duration-press` | 140ms | `:active` press feedback |
| `--duration-tooltip` | 150ms | tooltips |
| `--duration-popover` | 180ms | popovers |
| `--duration-dropdown` | 200ms | menus, selects, comboboxes |
| `--duration-modal` | 250ms | dialogs, backdrops |
| `--duration-drawer` | 350ms | sheets |
| `--motion-exit-ratio` | 0.7 | exits run at 70% of their entry |
| `--motion-press-scale` | 0.97 | pressed buttons (cards: `--motion-card-press-scale` 0.98 on the storefront) |

The `ease-out` and `ease-in-out` Tailwind classes resolve to these curves in both apps.

Rules:

- **Name the properties.** `transition-[color,background-color,scale]`, never `transition-all` /
  `transition: all`. Animate `transform`/`scale`/`opacity`; avoid width, height, margin.
- **Never `ease-in` on UI.** It starts slow, which reads as lag. Enter and exit use `--ease-out`.
- **Under 300ms** for UI (drawers excepted). Exits are quicker than entries.
- **Nothing appears from nothing.** Entries start at `scale(0.95–0.97)` with `opacity: 0`, never
  `scale(0)`.
- **Press feedback on every pressable.** `<Button>` (packages/ui) and the storefront `.btn` already
  do it: `:active` scales to `--motion-press-scale` with a 140ms ease-out, disabled buttons stay
  still. Cards and tiles that are links or buttons: add `motion-press` in the admin (it owns the
  element's transition, so use it instead of `transition-shadow`); on the storefront use
  `active:scale-(--motion-card-press-scale)` with a `scale` transition.
- **Popups grow from their trigger.** Base UI popovers, menus, selects and comboboxes use the
  `motion-popup` utility, tooltips `motion-tooltip`: `transform-origin: var(--transform-origin)`,
  `data-starting-style`/`data-ending-style` at opacity 0 + scale 0.97, CSS transitions (they
  retarget when reopened mid-way; keyframes restart). Dialogs use `motion-dialog` and stay centred.
  Every admin tooltip shares one `TooltipProvider` (`components/layout/motion-provider.tsx`), so
  after the first one the next opens instantly (`data-instant`, no animation).
- **Hover only with a mouse.** Both apps override Tailwind's `hover:` variant to
  `@media (hover: hover) and (pointer: fine)`, so `hover:`, `group-hover:` and `peer-hover:` never
  stick on a phone. Handwritten theme CSS wraps its `:hover` rules in the same query and keeps
  `:focus-visible` outside it.
- **Reduced motion keeps fades, drops movement.** Each app has one rule that sets the
  `--motion-*-scale` and offset tokens to "no movement" under `prefers-reduced-motion: reduce`.
  Motion (motion.dev) components follow the OS setting through `MotionConfig reducedMotion="user"`
  in the admin root; storefront components check `useReducedMotion`.
- **Feel native on a phone.** The storefront sets `viewport-fit=cover` (root layout), so fixed
  bottom bars, drawers and page margins pad with `env(safe-area-inset-*)`. Full-height panels use
  `dvh` (app-like) or `svh` (heroes, pinned stages), never `100vh`. Fields are at least 16px on
  touch screens so iOS does not zoom. Controls get `touch-action: manipulation`; scrollable
  drawers and overlays get `overscroll-behavior: contain`. Never disable zoom.

## Inline editing in theme sections

Text drawn on the canvas uses the field helpers in `packages/blocks/src/sections/inline-fields.ts`
(`inlineText`, `inlineTextarea`, `inlineRichtext`), so merchants click it in Customize and type.
In the editor Puck passes those props as React nodes, so a section only renders them, never
calls string methods on them or puts them in attributes. Body copy is Puck `richtext` (HTML) drawn
with `components/rich-copy.tsx`, which also reads older plain-string values.

## Code from other projects

Adapting open-source code is fine when its licence allows it and we keep its notice. Follow the
checklist in [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md): permissive licences only (MIT,
BSD, Apache 2.0), the full licence text beside the code, a comment on each adapted file, and a row
in the root index. GPL, AGPL and source-available licences are ideas only, never copied code.
