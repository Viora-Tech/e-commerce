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
5. Exactly one exported component. Small private sub-components may sit below the exported
   one if they are not exported; anything another file needs gets its own sibling file.
6. Component body, in this order:
   - hooks (`useState`, `useRouter`, `useEffect`, custom hooks)
   - derived values (plain `const`s computed from props and state)
   - handlers as arrow functions named `handleX`
   - early returns (`if (!data) return <Empty />`)
   - a single render `return`
7. No `useCallback`, `useMemo` or `React.memo`. The React Compiler memoises.
8. Soft cap 300 lines, hard cap 500. Split into sibling files rather than growing.

Naming: files are kebab-case and named after the component (`order-status-cell.tsx` exports
`OrderStatusCell`). Copy lives in `data/<feature>.ts`, never inline. Sizes are rem, never px.

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

export function TagsCard({ orderId, tags, onChanged }: TagsCardProps) {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const full = tags.length >= MAX_TAGS
  const next = normalise(draft)

  const handleAdd = async () => {
    if (!next || tags.includes(next)) return
    setSaving(true)
    try {
      await api.orders.setTags({ id: orderId, tags: [...tags, next] })
      setDraft('')
      toast.success(copy.saved)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  if (full) return <p className="text-body text-muted-foreground">{copy.limit(MAX_TAGS)}</p>

  return (
    <div className="flex gap-2">
      <input value={draft} onChange={(e) => setDraft(e.target.value)} disabled={saving} />
      <Button onClick={handleAdd} disabled={saving || !next}>
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
| Second exported component | `second exported component "X" (first: "Y"): one component per file` |
| `function name()` inside a component | `nested function "name" in X: move helpers to module scope` |
| `function handleX()` inside a component | `handler "handleX" must be an arrow function` |
| Hook after a handler or early return | `hook "useX" called after a handler in X: hooks first` |
| Second full `return` | `X has more than one top-level return` |
| `useCallback` / `useMemo` / `memo(` | `useX() is banned (React Compiler handles memoisation)` |
| Over 500 lines | error; over 300 lines: warning |
