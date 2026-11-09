import type { ImportResource, ResourceProgress } from '@commerce/plugin-shopify-import/client'
import { CircleCheck } from '@commerce/ui/icons'
import StatusChip from '@/components/layout/status-chip'
import { shopifyImportContent } from '@/data/shopify-import'
import { shopifyImportRunContent } from '@/data/shopify-import-run'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { RESOURCE_ICON } from './run-resource-icons'

type RunTypeCardProps = {
  resource: ImportResource
  progress: ResourceProgress
  /** True while the run is moving; the bar shows only then. */
  live: boolean
  /** A preview: amounts read "to import", not "imported". */
  preview: boolean
}

type Chip = {
  key: 'created' | 'updated' | 'skipped' | 'failed'
  tone: 'success' | 'info' | 'neutral' | 'danger'
}

const CHIPS: Chip[] = [
  { key: 'created', tone: 'success' },
  { key: 'updated', tone: 'info' },
  { key: 'skipped', tone: 'neutral' },
  { key: 'failed', tone: 'danger' },
]

/** One type: glyph and name, "276 of 276", a bar while it runs and chips for the non-zero outcomes. */
export default function RunTypeCard({ resource, progress, live, preview }: RunTypeCardProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.run)
  const view = useCopy(shopifyImportRunContent)
  const resources = useCopy(shopifyImportContent.resources)
  const fmt = useFormat()

  // Render logic
  const Icon = RESOURCE_ICON[resource]
  const finished = progress.processed >= progress.total
  const working = live && !finished
  const share = progress.total > 0 ? Math.min(1, progress.processed / progress.total) : 0
  const chips = CHIPS.filter((c) => progress[c.key] > 0)
  const credit = progress.credit

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-hairline bg-card p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
          <Icon />
        </span>
        <span className="min-w-0 flex-1 truncate font-medium text-ink-strong">
          {resources[resource]}
        </span>
        {finished && live ? (
          <CircleCheck
            weight="fill"
            className="size-4 shrink-0 text-success"
            aria-label={view.types.done}
          />
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-card-title text-ink-strong tabular-nums">
          {copy.counted(progress.processed, progress.total)}
        </span>
        {working ? (
          <span
            className="block h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.processed}
          >
            <span
              className="block h-full origin-left rounded-full bg-primary transition-transform duration-500 ease-linear motion-reduce:transition-none"
              style={{ transform: `scaleX(${share})` }}
            />
          </span>
        ) : null}
      </div>
      {credit ? (
        <span className="text-caption text-muted-foreground">
          {view.types.credit(credit.customers, fmt.money(credit.amountPaise), preview)}
        </span>
      ) : null}
      {chips.length ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <StatusChip key={c.key} tone={c.tone} className="h-5 px-2">
              {view.types[c.key](progress[c.key])}
            </StatusChip>
          ))}
        </div>
      ) : null}
    </li>
  )
}
