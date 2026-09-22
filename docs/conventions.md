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
barrels re-export with `export { default as X } from './components/x'`. Copy lives in `data/<feature>.ts`, never inline. Sizes are rem, never px.

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
