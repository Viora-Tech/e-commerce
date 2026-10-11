'use client'

import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { modKey } from '@/lib/assistant-events'
import { SHORTCUTS } from '@/lib/customize-shortcuts'

type ShortcutListProps = {
  /** Two columns, as the shortcuts dialog (Figma 392:11346); one in the Help panel. */
  columns?: 1 | 2
}

/**
 * Every editor shortcut (`lib/customize-shortcuts.ts`): its name on the left and the keys in one
 * small chip on the right ("⌘ Z"), shared by the Help panel and the shortcuts dialog.
 */
export default function ShortcutList({ columns = 1 }: ShortcutListProps) {
  // Hooks
  const copy = useCopy(customizeContent.help)

  // Render logic
  const mod = modKey()
  const half = columns === 2 ? Math.ceil(SHORTCUTS.length / 2) : SHORTCUTS.length
  const cols = [SHORTCUTS.slice(0, half), SHORTCUTS.slice(half)].filter((c) => c.length > 0)

  return (
    <div className="flex gap-8">
      {cols.map((col) => (
        <dl key={col[0]?.id} className="flex min-w-0 flex-1 flex-col gap-2">
          {col.map(({ id, keys }) => (
            <div key={id} className="flex min-h-[1.3125rem] items-center gap-2">
              <dt className="min-w-0 flex-1 truncate text-[0.8125rem] leading-[1.1875rem] text-foreground">
                {copy.keys[id]}
              </dt>
              <dd>
                <kbd className="rounded-md bg-muted px-1.5 py-0.5 font-sans text-xs leading-[1.0625rem] whitespace-nowrap text-muted-foreground">
                  {keys(mod)}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      ))}
    </div>
  )
}
