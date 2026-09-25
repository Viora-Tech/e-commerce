'use client'

import { cn } from '@commerce/ui/lib/utils'
import { useQueryState } from 'nuqs'
import { createContext, type ReactNode, useContext } from 'react'
import { settingsContent } from '@/data/settings'

export type SectionTab = { id: string; label: string }

type SectionTabsProps = {
  tabs: readonly SectionTab[]
  children: ReactNode
}

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

/* Tab strip under the page header: items sit on a bottom hairline; the active
   one carries a 2px marker over the line, offset by -1px so the two overlap. */
const ITEM = `relative -mb-px flex h-9 items-center border-b-2 border-transparent px-3 text-nav text-muted-foreground transition-colors hover:text-foreground ${FOCUS}`
const ITEM_ACTIVE = 'border-primary font-medium text-ink-strong'

const ActiveSectionContext = createContext<string | null>(null)

/** Reads the active tab id; `null` outside a `SectionTabs` (render everything). */
export function useActiveSection(): string | null {
  return useContext(ActiveSectionContext)
}

/** Horizontal tabs for a settings page; the URL (`?tab=`) remembers the choice. */
export default function SectionTabs({ tabs, children }: SectionTabsProps) {
  // Hooks
  const [tab, setTab] = useQueryState('tab', { defaultValue: tabs[0]?.id ?? '' })

  // Event handlers
  const handleSelect = (id: string) => {
    setTab(id === tabs[0]?.id ? null : id)
  }

  // Render logic
  const fallback = tabs[0]?.id ?? ''
  // No tabs (e.g. an app's Connect page): null tells every section to render.
  const active = tabs.length === 0 ? null : tabs.some((t) => t.id === tab) ? tab : fallback
  const showStrip = tabs.length > 1

  return (
    <ActiveSectionContext.Provider value={active}>
      {showStrip ? (
        <nav aria-label={settingsContent.nav.label} className="w-full">
          <div
            role="tablist"
            className="flex items-center gap-1 overflow-x-auto overflow-y-hidden border-border border-b"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active === t.id}
                onClick={() => handleSelect(t.id)}
                className={cn(ITEM, active === t.id && ITEM_ACTIVE)}
              >
                <span className="truncate">{t.label}</span>
              </button>
            ))}
          </div>
        </nav>
      ) : null}
      {children}
    </ActiveSectionContext.Provider>
  )
}
