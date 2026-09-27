'use client'

import type { SectionGroup } from '@commerce/core/theme'
import { Search } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Input } from '@commerce/ui/shadcn/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import { Drawer } from '@puckeditor/core'
import { useState } from 'react'
import { customizeContent } from '@/data/customize'
import { insertActions } from '@/lib/customize-insert'
import { useCustomizePuck } from '@/lib/customize-puck'
import AppsTab from './add-section-apps-tab'
import SectionsTab from './add-section-sections-tab'

type AddSectionBrowserProps = {
  /** Puck zone the section lands in when added by click, or dropped without crossing to another zone. */
  zone: string
  /** Header and footer groups only take their own sections; the persistent Add panel passes null. */
  group: SectionGroup | null
  /** Where a clicked section goes in `zone` (0 = first); `count` puts it at the end. */
  index: number
  /** How many sections `zone` holds now, to keep `index` in range. */
  count: number
  /** Closes the popover this sits in; the persistent Add panel leaves it out. */
  onAdd?: () => void
  /**
   * The persistent rail panel (`AddSectionPanel`) sits in a fixed-height column
   * and wants its list to fill that height with its own internal scroll. The
   * per-group popover (`AddSectionPopover`) floats over the canvas and wants a
   * capped height instead, so it never grows taller than the viewport.
   */
  fill?: boolean
}

const copy = customizeContent.addSection

/**
 * Shopify's "Add section": searchable, tabbed (Sections / Apps) and categorised,
 * with a glyph and one-line description each. Shared by the per-group popover
 * (`AddSectionPopover`) and the persistent Add rail panel.
 */
export default function AddSectionBrowser({
  zone,
  group,
  index,
  count,
  onAdd,
  fill,
}: AddSectionBrowserProps) {
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
    for (const action of insertActions({ zone, index }, type, count)) dispatch(action)
    setQuery('')
    onAdd?.()
  }

  // Render logic
  const listClass = fill
    ? 'flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto'
    : 'flex max-h-96 flex-col gap-1 overflow-y-auto'

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: clears the hover preview only; every item inside is its own focusable button.
    <div
      className={cn('relative flex flex-1 flex-col gap-2 p-2', fill && 'min-h-0')}
      onMouseLeave={() => setHovered(null)}
    >
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.search}
          aria-label={copy.search}
          className="h-8 rounded-lg bg-muted/60 pl-8 text-[0.8125rem] shadow-none focus-visible:bg-card"
        />
      </div>
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as 'sections' | 'apps')}
        className={cn('gap-2', fill && 'min-h-0 flex-1')}
      >
        <TabsList variant="line" className="gap-4 px-1 text-[0.8125rem]">
          <TabsTrigger value="sections">{copy.tabs.sections}</TabsTrigger>
          <TabsTrigger value="apps">{copy.tabs.apps}</TabsTrigger>
        </TabsList>
        <TabsContent value="sections" className={cn(fill && 'flex min-h-0 flex-col')}>
          <Drawer>
            <div className={listClass}>
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
        <TabsContent value="apps" className={cn(fill && 'flex min-h-0 flex-col')}>
          <Drawer>
            <div className={listClass}>
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
