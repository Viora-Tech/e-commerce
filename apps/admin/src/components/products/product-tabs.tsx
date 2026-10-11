'use client'

import { cn } from '@commerce/ui/lib/utils'
import type { KeyboardEvent, ReactNode } from 'react'
import type { ProductLayout } from '@/lib/product-layout'

export type ProductTabItem = {
  id: string
  label: string
  /** One line saying what the tab covers, shown above its cards. */
  description: string
  error: boolean
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

/* "tabs" look: the segmented strip the page used to carry in its header. */
const STRIP =
  'no-scrollbar inline-flex w-fit max-w-full gap-0.5 self-start overflow-x-auto rounded-[0.6875rem] bg-muted p-[0.1875rem]'
const STRIP_TAB =
  'h-[1.875rem] rounded-[0.5rem] border border-transparent px-3 text-body font-medium text-muted-foreground hover:text-foreground'
const STRIP_TAB_ACTIVE = 'border-border bg-card font-semibold text-ink-strong shadow-lift'

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
 * definitions) and one panel per tab. Every panel stays mounted and the inactive ones are
 * `hidden`, so cards keep their own state while you switch.
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
            {panels[t.id]}
          </div>
        ))}
      </div>
    </div>
  )
}
