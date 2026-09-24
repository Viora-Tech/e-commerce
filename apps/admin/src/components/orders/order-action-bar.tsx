'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { orderDetailContent as copy } from '@/data/orders'
import { base, instant } from '@/lib/motion'

type OrderActionBarProps = {
  /** The one thing this order is waiting for; nothing renders without it. */
  action: { label: string; onClick: () => void } | null
  orderNumber: number
  busy: boolean
}

const SHOW_AFTER_PX = 240

/** The order's next step, kept in reach once the page has scrolled past the header. */
export default function OrderActionBar({ action, orderNumber, busy }: OrderActionBarProps) {
  // Hooks
  const reduced = useReducedMotion()
  const [past, setPast] = useState(false)

  useEffect(() => {
    /* The admin scrolls inside <main>, not the window. */
    const scroller = document.getElementById('main')
    if (!scroller) return
    const onScroll = () => setPast(scroller.scrollTop > SHOW_AFTER_PX)
    onScroll()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])

  // Render logic
  const slide = reduced ? instant : base
  const open = past && action !== null

  return (
    <AnimatePresence initial={false}>
      {open && action ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={slide}
          className="sticky bottom-4 z-30 mx-auto flex w-full max-w-2xl items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 shadow-popover print:hidden"
        >
          <p className="text-body font-medium">{copy.title(orderNumber)}</p>
          <Button size="sm" onClick={action.onClick} disabled={busy}>
            {action.label}
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
