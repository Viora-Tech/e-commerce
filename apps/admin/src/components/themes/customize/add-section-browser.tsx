'use client'

import type { SectionGroup } from '@commerce/core/theme'
import { Search } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import { Drawer } from '@puckeditor/core'
import { useState } from 'react'
import { customizeContent } from '@/data/customize'
import { useCustomizePuck } from '@/lib/customize-puck'
import AppsTab from './add-section-apps-tab'
import SectionsTab from './add-section-sections-tab'

type AddSectionBrowserProps = {
  /** Puck zone the section lands in when added by click, or dropped without crossing to another zone. */
  zone: string
  /** Header and footer groups only take their own sections; the persistent Add panel passes null. */
  group: SectionGroup | null
  count: number
  /** Closes the popover this sits in; the persistent Add panel leaves it out. */
  onAdd?: () => void
}

const copy = customizeContent.addSection

/**
 * Shopify's "Add section": searchable, tabbed (Sections / Apps) and categorised,
 * with a glyph and one-line description each. Shared by the per-group popover
 * (`AddSectionPopover`) and the persistent Add rail panel.
 */
export default function AddSectionBrowser({ zone, group, count, onAdd }: AddSectionBrowserProps) {
  // Hooks
  const [tab, setTab] = useState<'sections' | 'apps'>('sections')
  const [query, setQuery] = useState('')
  const [hovered, setHovered] = useState<string | null>(null)
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const components = useCustomizePuck((s) => s.config.components)

  // Helpers
  const labelOf = (type: string) => components[type]?.label ?? type

  // Event handlers
  const handleAdd = (type: string) => {
    dispatch({
      type: 'insert',
      componentType: type,
      destinationIndex: count,
      destinationZone: zone,
    })
    dispatch({ type: 'setUi', ui: { itemSelector: { index: count, zone } } })
    setQuery('')
    onAdd?.()
  }

  // Render logic
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: clears the hover preview only; every item inside is its own focusable button.
    <div className="relative flex flex-1 flex-col gap-2 p-2" onMouseLeave={() => setHovered(null)}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.search}
          aria-label={copy.search}
          className="pl-8"
        />
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'sections' | 'apps')} className="gap-2">
        <TabsList variant="line" className="gap-4">
          <TabsTrigger value="sections">{copy.tabs.sections}</TabsTrigger>
          <TabsTrigger value="apps">{copy.tabs.apps}</TabsTrigger>
        </TabsList>
        <TabsContent value="sections">
          <Drawer>
            <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
              <SectionsTab
                group={group}
                query={query}
                hovered={hovered}
                onHover={setHovered}
                labelOf={labelOf}
                onAdd={handleAdd}
              />
            </div>
          </Drawer>
        </TabsContent>
        <TabsContent value="apps">
          <Drawer>
            <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
              <AppsTab
                query={query}
                hovered={hovered}
                onHover={setHovered}
                labelOf={labelOf}
                onAdd={handleAdd}
              />
            </div>
          </Drawer>
        </TabsContent>
      </Tabs>
    </div>
  )
}
