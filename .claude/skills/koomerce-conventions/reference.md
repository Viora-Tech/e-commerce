# Conventions reference

## Example component

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

In a real admin component read the copy with `const copy = useCopy(tagsContent)` inside
`// Hooks` so Hindi members get Hindi.

## What `scripts/check-components.ts` reports

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
| `'use client'` file importing a value from `@commerce/core` or `@commerce/db` | `'use client' module imports values from "@commerce/core", ...` |

## Hindi overlay file

```ts
// apps/admin/src/data/hi/orders.ts
import { ordersContent } from '@/data/orders'
import { translation, untranslated } from '@/lib/i18n'

export default [
  translation(ordersContent, {
    title: 'ऑर्डर',
    count: (n) => `${n} ऑर्डर`,
    newBanner: untranslated, // shows English until translated
  }),
]
```

Then spread it into `hindiCopy` in `apps/admin/src/data/hi/index.ts`. Keep `data/*.ts` free of
imports from `lib/copy`, `lib/format*`, `lib/page-names` and `lib/status-labels` (import cycle;
a test enforces it).

## Sweeps that touch conventions

From `docs/guardrails.md`: `file-size`, `hardcoded-colours`, `money-format`, `date-format`,
`smooth-ui`, `site-config` (no literal brand name outside `packages/config/src/site.ts`; tests
and the docs app excepted), `client-imports-server`. Run one with
`bun run test:sweeps -- scripts/sweeps/<name>.test.ts`.
