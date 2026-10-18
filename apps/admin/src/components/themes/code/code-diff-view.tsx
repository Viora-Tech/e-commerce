'use client'

import { cn } from '@commerce/ui/lib/utils'
import type { DiffRow } from '@/lib/line-diff'

type CodeDiffViewProps = {
  rows: readonly DiffRow[]
  leftTitle: string
  rightTitle: string
}

const CELL = 'flex h-5 min-w-0 items-center font-mono text-[0.8125rem] leading-5 whitespace-pre'

/**
 * Version history · diff (Figma 699:94938): the saved version on the left, the open file on the
 * right; removed lines red with "−", added lines green with "+", a changed line side by side.
 */
export default function CodeDiffView({ rows, leftTitle, rightTitle }: CodeDiffViewProps) {
  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-background">
      <div className="flex min-w-0 flex-1 flex-col border-r border-border">
        <div className="sticky top-0 flex h-8 shrink-0 items-center bg-background px-4 font-mono text-caption text-muted-foreground">
          {leftTitle}
        </div>
        {rows.map((row, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: rows of one diff, in order
            key={i}
            className={cn(CELL, row.left?.removed && 'bg-destructive/15')}
          >
            {row.left ? (
              <>
                <span
                  className={cn(
                    'w-14 shrink-0 pr-3 text-right tabular-nums',
                    row.left.removed ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {row.left.removed ? `− ${row.left.no}` : row.left.no}
                </span>
                <span className="truncate text-foreground">{row.left.text}</span>
              </>
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 flex h-8 shrink-0 items-center bg-background px-4 font-mono text-caption text-muted-foreground">
          {rightTitle}
        </div>
        {rows.map((row, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: rows of one diff, in order
            key={i}
            className={cn(CELL, row.right?.added && 'bg-success/15')}
          >
            {row.right ? (
              <>
                <span
                  className={cn(
                    'w-14 shrink-0 pr-3 text-right tabular-nums',
                    row.right.added ? 'text-success' : 'text-muted-foreground',
                  )}
                >
                  {row.right.added ? `+ ${row.right.no}` : row.right.no}
                </span>
                <span className="truncate text-foreground">{row.right.text}</span>
              </>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
