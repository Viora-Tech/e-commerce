'use client'

import { ChevronDown } from '@commerce/ui/icons'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { type MouseEvent, useState } from 'react'
import ProductThumb from '@/components/products/product-thumb'
import { ordersContent } from '@/data/orders'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Line = Awaited<ReturnType<typeof api.orders.linePeek>>[number]

type OrderLinesPopoverProps = {
  orderId: string
  /** How many lines the order has (the list row's count). */
  lineCount: number
  /** The trigger's text, e.g. "+2 more". */
  label: string
}

/** The popover is portalled, but React still bubbles its clicks to the row, which navigates. */
function stop(e: MouseEvent) {
  e.stopPropagation()
}

/**
 * "+n more" on an Orders list row with an arrow: opens a small popover listing the order's
 * items (picture, title, variant, quantity), fetched when first opened (#1008).
 */
export default function OrderLinesPopover({ orderId, lineCount, label }: OrderLinesPopoverProps) {
  // Hooks
  const copy = useCopy(ordersContent)
  const [lines, setLines] = useState<Line[] | null>(null)
  const [failed, setFailed] = useState(false)

  // Event handlers
  const handleOpenChange = (open: boolean) => {
    if (!open || lines) return
    setFailed(false)
    api.orders.linePeek({ id: orderId }).then(setLines, () => setFailed(true))
  }

  // Render logic
  const peek = copy.linePeek
  const hidden = lines ? lineCount - lines.length : 0

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger
        onClick={stop}
        aria-label={peek.open(lineCount)}
        className="inline-flex items-center gap-0.5 rounded-sm text-period text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        {label}
        <ChevronDown className="size-3" aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        onClick={stop}
        className="max-h-[min(24rem,70svh)] w-[min(20rem,calc(100vw-2rem))] cursor-default overflow-y-auto"
      >
        <p className="text-body font-medium text-popover-foreground">{peek.title(lineCount)}</p>
        {failed ? (
          <p className="text-caption text-destructive">{peek.failed}</p>
        ) : !lines ? (
          <p className="text-caption text-muted-foreground">{peek.loading}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center gap-2.5">
                <ProductThumb url={l.image} alt={l.title ?? ''} className="rounded-[0.375rem]" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-caption font-normal text-foreground">
                    {l.title ?? peek.untitled}
                  </span>
                  {l.variantTitle ? (
                    <span className="line-clamp-1 text-period text-muted-foreground">
                      {l.variantTitle}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-period text-muted-foreground tabular-nums">
                  {peek.quantity(l.quantity)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {hidden > 0 ? <p className="text-caption text-muted-foreground">{peek.more}</p> : null}
      </PopoverContent>
    </Popover>
  )
}
