'use client'

import { ChevronRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { useState } from 'react'
import { dateRangeContent } from '@/data/date-range'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type SaleDay = Awaited<ReturnType<typeof api.analytics.bigSaleDays>>[number]

type BigSaleDaysProps = {
  /** The day picked, as an ISO date. */
  onPick: (day: string) => void
}

/** Figma date picker "Big sale days ›": the store's own best days of the last year, loaded on open. */
export default function BigSaleDays({ onPick }: BigSaleDaysProps) {
  // Hooks
  const copy = useCopy(dateRangeContent)
  const fmt = useFormat()
  const [open, setOpen] = useState(false)
  const [days, setDays] = useState<SaleDay[] | null>(null)
  const [failed, setFailed] = useState(false)

  // Event handlers
  const handleToggle = () => {
    const next = !open
    setOpen(next)
    if (!next || days) return
    setFailed(false)
    api.analytics
      .bigSaleDays()
      .then(setDays)
      .catch(() => setFailed(true))
  }

  // Render logic
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={handleToggle}
        className="flex h-8 w-full items-center justify-between rounded-sm px-2.5 text-left text-body transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {copy.bigSale.label}
        <ChevronRight
          className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-90')}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <ul className="ml-2 flex flex-col gap-0.5 border-border border-l py-1 pl-2">
          {failed ? (
            <li className="px-2 py-1 text-caption text-muted-foreground">{copy.bigSale.failed}</li>
          ) : days === null ? (
            <li className="px-2 py-1 text-caption text-muted-foreground">{copy.bigSale.loading}</li>
          ) : days.length === 0 ? (
            <li className="px-2 py-1 text-caption text-muted-foreground">{copy.bigSale.empty}</li>
          ) : (
            days.map((d) => (
              <li key={d.day}>
                <button
                  type="button"
                  onClick={() => onPick(d.day)}
                  className="flex w-full flex-col rounded-sm px-2 py-1 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-body">
                    {fmt.pattern(new Date(`${d.day}T00:00:00`), {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="text-caption text-muted-foreground">
                    {copy.bigSale.line(fmt.money(d.revenuePaise), d.orders)}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
