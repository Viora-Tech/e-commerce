'use client'

import { cn } from '@commerce/ui/lib/utils'
import { type ReactNode, useEffect, useState } from 'react'

type AppStickyBarProps = {
  /** The element id of the header's own buttons; the bar shows once they scroll away. */
  watch: string
  tile: ReactNode
  name: string
  price: string
  actions: ReactNode
}

/**
 * The app page's compact bar: once the header's Install button has scrolled out of view, a glass
 * bar with the icon, name, price and Install slides up from the bottom of the screen, over
 * the home indicator, clear of the site nav. Fades only under reduced motion.
 */
export default function AppStickyBar({ watch, tile, name, price, actions }: AppStickyBarProps) {
  // Hooks
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const target = document.getElementById(watch)
    if (!target) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setShown(!entry.isIntersecting && entry.boundingClientRect.top < 0)
      },
      { threshold: 0 },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [watch])

  return (
    <div
      inert={!shown}
      className={cn(
        'fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-[opacity,translate] duration-(--duration-modal) ease-out motion-reduce:translate-y-0 md:px-8 md:pb-6 print:hidden',
        shown
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-4 opacity-0',
      )}
    >
      <div className="glass-panel mx-auto flex max-w-[75rem] items-center gap-3 rounded-2xl p-2 pl-3 md:rounded-full md:pl-2">
        {tile}
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-sm font-semibold text-foreground">{name}</span>
          <span className="truncate text-xs text-muted-foreground tabular-nums">{price}</span>
        </span>
        {actions}
      </div>
    </div>
  )
}
