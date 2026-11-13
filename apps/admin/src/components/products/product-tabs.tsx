'use client'

import { cn } from '@commerce/ui/lib/utils'
import type { KeyboardEvent, ReactNode } from 'react'
import CountBadge from '@/components/layout/count-badge'
import { useVisited } from '@/hooks/use-visited'
import type { ProductLayout } from '@/lib/product-layout'

export type ProductTabItem = {
  id: string
  label: string
  /** One line saying what the tab covers, shown above its cards. */
  description: string
  error: boolean
  /** How many photos or variants the tab holds, shown beside its label. */
  count?: string | undefined
  /** Something to look at but not a blocker (no HS code): an amber dot. */
  warn?: boolean | undefined
}

type ProductTabsProps = {
  label: string
  errorLabel: string
  layout: ProductLayout
  tabs: ProductTabItem[]
  active: string
  /** `replace` is set for arrow-key moves, so they do not each add a history entry. */
  onSelect: (id: string, replace?: boolean) => void
  panels: Partial<Record<string, ReactNode>>
}

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

/* "tabs" look: Figma's underline strip (631:7713), a 2px ink rule under the open tab. */
const STRIP = 'no-scrollbar flex max-w-full gap-6 overflow-x-auto border-b border-border'
const STRIP_TAB =
  'relative -mb-px h-11 border-b-2 border-transparent px-1 text-body text-muted-foreground hover:text-foreground'
const STRIP_TAB_ACTIVE = 'border-foreground font-medium text-ink-strong'

/* "settings" look: the Settings rail and the app pages' AppNav; a scrolling row on phones. */
const RAIL =
  'no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 md:sticky md:top-6 md:mx-0 md:w-[13.75rem] md:shrink-0 md:flex-col md:self-start md:overflow-visible md:px-0'
const RAIL_TAB =
  'h-[1.875rem] rounded-[0.5rem] px-3 text-nav text-ink-strong hover:bg-muted md:w-full md:pl-5'
const RAIL_TAB_ACTIVE = 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent'

const NEXT_KEYS = ['ArrowRight', 'ArrowDown']
const PREV_KEYS = ['ArrowLeft', 'ArrowUp']

function tabDomId(id: string): string {
  return `product-tab-${id}`
}

function panelDomId(id: string): string {
  return `product-panel-${id}`
}

/**
 * The product page's left column as real tabs: one tablist (a strip or a vertical rail, same
 * definitions) and one panel per tab. A panel's cards mount when its tab is first opened (so a
 * page load reads only the open tab's data: stock history, Search Console and app sections wait
 * for theirs), then stay mounted and `hidden`, so cards keep their own state while you switch.
 */
export default function ProductTabs({
  label,
  errorLabel,
  layout,
  tabs,
  active,
  onSelect,
  panels,
}: ProductTabsProps) {
  // Hooks
  // A tab opened by a click, a link, a save error or the checklist stays mounted from then on.
  const opened = useVisited(active)

  // Event handlers
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((t) => t.id === active)
    let next = -1
    if (NEXT_KEYS.includes(event.key)) next = (index + 1) % tabs.length
    else if (PREV_KEYS.includes(event.key)) next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    const target = tabs[next]
    if (!target) return
    event.preventDefault()
    onSelect(target.id, true)
    document.getElementById(tabDomId(target.id))?.focus()
  }

  // Render logic
  const rail = layout === 'settings'

  return (
    <div className={cn('flex min-w-0 flex-col gap-6', rail && 'md:flex-row md:items-start')}>
      <div
        role="tablist"
        aria-label={label}
        aria-orientation={rail ? 'vertical' : 'horizontal'}
        onKeyDown={handleKeyDown}
        className={rail ? RAIL : STRIP}
      >
        {tabs.map((t) => {
          const selected = t.id === active
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={tabDomId(t.id)}
              aria-selected={selected}
              aria-controls={panelDomId(t.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(t.id)}
              className={cn(
                'flex min-w-0 shrink-0 items-center gap-2 whitespace-nowrap transition-colors',
                FOCUS,
                rail ? RAIL_TAB : STRIP_TAB,
                selected && (rail ? RAIL_TAB_ACTIVE : STRIP_TAB_ACTIVE),
              )}
            >
              <span className="min-w-0 truncate">{t.label}</span>
              {t.count ? (
                <CountBadge
                  n={t.count}
                  tone={selected && !rail ? 'inverse' : 'muted'}
                  className={selected && !rail ? 'h-4.5 rounded-full px-1.5' : 'py-0'}
                />
              ) : null}
              {t.warn && !t.error ? (
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-warning" />
              ) : null}
              {t.error ? (
                <>
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-destructive" />
                  <span className="sr-only">{errorLabel}</span>
                </>
              ) : null}
            </button>
          )
        })}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {tabs.map((t) => (
          <div
            key={t.id}
            role="tabpanel"
            id={panelDomId(t.id)}
            aria-labelledby={tabDomId(t.id)}
            hidden={t.id !== active}
            className="flex min-w-0 flex-col gap-6"
          >
            <p className="text-body text-muted-foreground">{t.description}</p>
            {opened.includes(t.id) ? panels[t.id] : null}
          </div>
        ))}
      </div>
    </div>
  )
}
