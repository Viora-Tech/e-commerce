'use client'

import { ArrowDown, ArrowUp, X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'

/** One product in an ordered pick list (pins, recommendations). */
export type PickedItem = { id: string; title: string; status: string }

type PickedListProps = {
  items: PickedItem[]
  onChange: (items: PickedItem[]) => void
  empty: string
  labels: { moveUp: string; moveDown: string; remove: string }
  /** Badge text for products a shopper cannot see (draft, archived). */
  statusLabel?: (status: string) => string | null
}

/** `items` with the one at `from` moved to `to`. */
function moved(items: PickedItem[], from: number, to: number): PickedItem[] {
  if (to < 0 || to >= items.length) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  if (item) next.splice(to, 0, item)
  return next
}

/** An ordered list of picked products with move up, move down and remove on each row. */
export default function PickedList({
  items,
  onChange,
  empty,
  labels,
  statusLabel,
}: PickedListProps) {
  // Early returns
  if (items.length === 0) return <p className="py-3 text-body text-muted-foreground">{empty}</p>

  // Render logic
  return (
    <ol className="flex flex-col divide-y divide-line rounded-lg border border-line">
      {items.map((item, i) => {
        const badge = statusLabel?.(item.status) ?? null
        return (
          <li key={item.id} className="flex items-center gap-3 px-3 py-2">
            <span className="w-6 text-right text-body text-muted-foreground tabular-nums">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-body">{item.title}</span>
            {badge ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-caption text-muted-foreground">
                {badge}
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={labels.moveUp}
              disabled={i === 0}
              onClick={() => onChange(moved(items, i, i - 1))}
            >
              <ArrowUp aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={labels.moveDown}
              disabled={i === items.length - 1}
              onClick={() => onChange(moved(items, i, i + 1))}
            >
              <ArrowDown aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={labels.remove}
              onClick={() => onChange(items.filter((x) => x.id !== item.id))}
            >
              <X aria-hidden="true" />
            </Button>
          </li>
        )
      })}
    </ol>
  )
}
