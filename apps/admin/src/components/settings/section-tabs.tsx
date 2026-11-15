'use client'

import { useQueryState } from 'nuqs'
import { createContext, type ReactNode, useContext, useEffect } from 'react'
import PillTabs from '@/components/layout/pill-tabs'
import { settingsContent } from '@/data/settings'
import { useCopy } from '@/hooks/use-copy'

export type SectionTab = { id: string; label: string }

type SectionTabsProps = {
  tabs: readonly SectionTab[]
  children: ReactNode
  /** `#anchor` → tab id, so an old link to a card (`/settings/taxes#invoice-numbers`) opens
   *  the tab that card now sits on. */
  hashTabs?: Readonly<Record<string, string>>
}

const ActiveSectionContext = createContext<string | null>(null)

/** Reads the active tab id; `null` outside a `SectionTabs` (render everything). */
export function useActiveSection(): string | null {
  return useContext(ActiveSectionContext)
}

/** Horizontal tabs for a settings page; the URL (`?tab=`) remembers the choice. */
export default function SectionTabs({ tabs, children, hashTabs }: SectionTabsProps) {
  // Hooks
  const copy = useCopy(settingsContent)
  const [tab, setTab] = useQueryState('tab', { defaultValue: tabs[0]?.id ?? '' })
  useEffect(() => {
    const target = hashTabs?.[window.location.hash.slice(1)]
    if (target) setTab(target === tabs[0]?.id ? null : target)
  }, [hashTabs, tabs, setTab])

  // Event handlers
  const handleSelect = (id: string) => {
    // A card's #anchor from an old link would pull a reload back to that card's tab.
    if (hashTabs && window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.href.split('#')[0])
    }
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
        <nav aria-label={copy.nav.label} className="w-full">
          <PillTabs
            className="no-scrollbar w-full overflow-x-auto overflow-y-hidden border-border border-b"
            value={active}
            onChange={(id) => id && handleSelect(id)}
            tabs={tabs.map((t) => ({
              value: t.id,
              label: <span className="truncate">{t.label}</span>,
            }))}
          />
        </nav>
      ) : null}
      {children}
    </ActiveSectionContext.Provider>
  )
}
