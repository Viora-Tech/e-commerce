'use client'

import {
  AiIcon,
  ArrowRight_ as ArrowRight,
  CreditCard_ as CreditCard,
  Globe,
  Truck_ as Truck,
  Upload_ as Upload,
  Workflow,
} from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import type { ComponentType, KeyboardEvent } from 'react'
import { homeContent, type TourItem } from '@/data/home'
import IconBadge from '../common/icon-badge'
import LineReveal from '../common/line-reveal'

type TourRailProps = {
  items: readonly TourItem[]
  active: number
  paused: boolean
  onSelect: (index: number) => void
  /** The active item's progress line finished: advance. */
  onFinished: () => void
}

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  ai: AiIcon,
  live: Globe,
  automations: Workflow,
  theme: Upload,
  checkout: CreditCard,
  shipping: Truck,
}

export default function TourRail({ items, active, paused, onSelect, onFinished }: TourRailProps) {
  // Event handlers
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    const next = (active + step + items.length) % items.length
    onSelect(next)
    document.getElementById(`tour-tab-${items[next]?.key}`)?.focus()
  }

  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      aria-label={homeContent.tour.tablistLabel}
      className="hidden w-full max-w-100 flex-col gap-1.5 self-start pt-12 lg:flex"
    >
      {items.map((item, index) => {
        const selected = index === active
        const Icon = ICONS[item.key] ?? AiIcon
        return (
          <div
            key={item.key}
            className={cn(
              'group relative overflow-hidden rounded-2xl transition-colors duration-(--duration-popover) ease-out',
              selected && 'glass-panel',
            )}
          >
            <button
              type="button"
              role="tab"
              id={`tour-tab-${item.key}`}
              aria-selected={selected}
              aria-controls="tour-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(index)}
              onKeyDown={handleKeyDown}
              className="flex w-full items-start gap-4 p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <IconBadge className="shrink-0">
                <Icon aria-hidden className="size-5" />
              </IconBadge>
              <span className="flex flex-col gap-1.5">
                <span
                  className={cn(
                    'font-semibold',
                    selected ? 'text-lg text-foreground' : 'pt-2 text-base text-muted-foreground',
                  )}
                >
                  {item.title}
                </span>
                {selected ? (
                  <LineReveal
                    key={item.key}
                    as="span"
                    className="block text-sm text-muted-foreground"
                  >
                    {item.description}
                  </LineReveal>
                ) : null}
              </span>
            </button>
            {selected ? (
              <>
                <a
                  href={item.learnMoreHref}
                  className="mb-4 ml-[4.5rem] inline-flex items-center gap-2 text-sm font-semibold text-foreground underline underline-offset-4"
                >
                  {homeContent.tour.learnMore}
                  <ArrowRight aria-hidden className="size-3.5" />
                </a>
                <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-border">
                  <span
                    key={active}
                    data-paused={paused}
                    onAnimationEnd={onFinished}
                    className="animate-tour-fill block size-full bg-cta"
                  />
                </span>
              </>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
