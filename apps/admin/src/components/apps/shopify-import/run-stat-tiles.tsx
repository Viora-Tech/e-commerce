import { cn } from '@commerce/ui/lib/utils'
import { shopifyImportRunContent } from '@/data/shopify-import-run'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { RunDetail } from './types'
import { totals } from './types'

type RunStatTilesProps = { run: RunDetail }

type StatKey = keyof (typeof shopifyImportRunContent)['stats']

const KEYS: StatKey[] = ['total', 'created', 'updated', 'skipped', 'failed']

/** Five figures for the whole run; a zero reads muted, and Failed turns red only above zero. */
export default function RunStatTiles({ run }: RunStatTilesProps) {
  // Hooks
  const copy = useCopy(shopifyImportRunContent)
  const fmt = useFormat()

  // Render logic
  const sum = totals(run.progress)
  if (sum.total === 0) return null

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {KEYS.map((key) => {
        const value = sum[key]
        return (
          <div
            key={key}
            className={cn(
              'flex flex-col gap-1 rounded-xl surface-card p-4 first:col-span-2 sm:first:col-span-1',
              value === 0 && 'bg-none',
            )}
          >
            <dt className="text-caption text-muted-foreground">{copy.stats[key]}</dt>
            <dd
              className={cn(
                'text-stat tabular-nums',
                value === 0
                  ? 'text-muted-foreground/60'
                  : key === 'failed'
                    ? 'text-danger'
                    : 'text-ink-strong',
              )}
            >
              {fmt.number(value)}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
