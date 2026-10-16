'use client'

import { ChevronDown } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { homePageContent } from '@/data/home'
import { useCopy } from '@/hooks/use-copy'
import { instant, layout } from '@/lib/motion'
import MiniSparkline from './mini-sparkline'

type MoreNumbersProps = {
  children: ReactNode
  /** The 30-day series Home already loaded; payments has none, so its line stays still. */
  salesPreview: number[]
  ordersPreview: number[]
}

/**
 * "More numbers": the charts that are not in the Home design (sales over time, top products,
 * payments, states, the hours heatmap, the monthly goal) kept one click away, collapsed.
 * The header previews three tiny lines; opening grows the panel over 300ms.
 */
export default function MoreNumbers({ children, salesPreview, ordersPreview }: MoreNumbersProps) {
  // Hooks
  const copy = useCopy(homePageContent)
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(false)

  // Event handlers
  const handleToggle = () => {
    setOpen((was) => !was)
  }

  // Render logic
  const c = copy.more
  const grow = reduced ? instant : layout

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        aria-expanded={open}
        onClick={handleToggle}
        className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-card-title text-ink-strong">{c.title}</span>
          <span className="text-caption font-normal text-muted-foreground">{c.subtitle}</span>
        </span>
        <span className="hidden min-w-0 flex-1 items-center justify-end gap-5 px-2 md:flex">
          <MiniSparkline values={salesPreview} label={c.previewSales} />
          <MiniSparkline values={ordersPreview} label={c.previewProducts} />
          <MiniSparkline values={[]} label={c.previewPayments} />
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out motion-reduce:transition-none',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={grow}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-5">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
