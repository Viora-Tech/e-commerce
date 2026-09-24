'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import { Puck } from '@measured/puck'
import type { ReactNode } from 'react'
import { customizeContent } from '@/data/customize'
import { themesContent } from '@/data/themes'
import type { PreviewDevice } from '../theme-preview'
import SectionInspector from './section-inspector'
import SectionsTree from './sections-tree'

type CustomizeLayoutProps = {
  topBar: ReactNode
  /** The Theme settings tab (presets and settings groups). */
  settings: ReactNode
  device: PreviewDevice
  loading: boolean
}

const DEVICE_WIDTH: Record<PreviewDevice, string> = {
  desktop: 'w-full',
  tablet: 'w-[48rem] max-w-full',
  mobile: 'w-[24.375rem] max-w-full',
}

const copy = customizeContent

/**
 * Shopify's three panes inside one Puck provider: the Sections tree and Theme
 * settings on the left, Puck's preview in the middle, the selected section's
 * settings on the right.
 */
export default function CustomizeLayout({
  topBar,
  settings,
  device,
  loading,
}: CustomizeLayoutProps) {
  // Render logic
  return (
    <div className="flex h-svh flex-col bg-background">
      {topBar}
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[20rem] shrink-0 flex-col border-r border-border bg-card">
          <Tabs defaultValue="sections" className="min-h-0 flex-1 gap-0">
            <TabsList
              variant="line"
              aria-label={themesContent.editor.panelLabel}
              className="w-auto justify-start gap-4 border-b border-border px-3 pt-1"
            >
              <TabsTrigger value="sections">{copy.tabs.sections}</TabsTrigger>
              <TabsTrigger value="settings">{copy.tabs.settings}</TabsTrigger>
            </TabsList>
            <TabsContent value="sections" className="min-h-0 flex-1 overflow-y-auto">
              <SectionsTree />
            </TabsContent>
            <TabsContent value="settings" className="min-h-0 flex-1 overflow-y-auto">
              {settings}
            </TabsContent>
          </Tabs>
        </aside>
        <main id="main" className="flex min-w-0 flex-1 justify-center bg-muted p-3">
          <div
            className={cn(
              'h-full overflow-hidden rounded-lg bg-card shadow-sm transition-[width] duration-300',
              DEVICE_WIDTH[device],
              loading && 'pointer-events-none opacity-60 transition-opacity duration-200',
            )}
          >
            <Puck.Preview />
          </div>
        </main>
        <aside className="flex w-[20rem] shrink-0 flex-col border-l border-border bg-card">
          <SectionInspector />
        </aside>
      </div>
    </div>
  )
}
