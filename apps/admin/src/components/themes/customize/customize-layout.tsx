'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Puck } from '@puckeditor/core'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { CHROME_PANEL } from '@/lib/customize-chrome'
import type { InsertTarget } from '@/lib/customize-insert'
import { InsertContext } from '@/lib/customize-insert-context'
import type { PreviewDevice } from '../theme-preview'
import AddSectionDialog from './add-section-dialog'
import AddSectionPanel from './add-section-panel'
import CustomizeRail, { type RailPanel } from './customize-rail'
import PanelHeader from './panel-header'
import SectionInspector from './section-inspector'
import SectionsTree from './sections-tree'

type CustomizeLayoutProps = {
  topBar: ReactNode
  /** The Theme settings panel (presets and settings groups). */
  settings: ReactNode
  /** Floating controls over the bottom of the canvas. */
  dock: ReactNode
  device: PreviewDevice
  loading: boolean
}

const DEVICE_WIDTH: Record<PreviewDevice, string> = {
  desktop: 'w-full',
  tablet: 'w-[48rem] max-w-full',
  mobile: 'w-[24.375rem] max-w-full',
}

/**
 * Shopify's three panes inside one Puck provider, Puck Cloud's rail on the
 * left: Sections / Add / Theme settings, Puck's preview in the middle, the
 * selected section's settings on the right.
 */
export default function CustomizeLayout({
  topBar,
  settings,
  dock,
  device,
  loading,
}: CustomizeLayoutProps) {
  // Hooks
  const [panel, setPanel] = useState<RailPanel>('sections')
  const [inserting, setInserting] = useState<InsertTarget | null>(null)
  const reducedMotion = useReducedMotion()
  const panels = useCopy(customizeContent.panels)

  // Render logic
  const headers: Record<RailPanel, { title: string; hint: string }> = {
    sections: { title: panels.sections, hint: panels.sectionsHint },
    add: { title: panels.add, hint: panels.addHint },
    theme: { title: panels.theme, hint: panels.themeHint },
  }
  const panelContent =
    panel === 'theme' ? settings : panel === 'add' ? <AddSectionPanel /> : <SectionsTree />

  return (
    <InsertContext.Provider value={setInserting}>
      <div className="flex h-svh flex-col bg-sidebar">
        {topBar}
        <div className="flex min-h-0 flex-1 border-t border-border">
          <CustomizeRail active={panel} onChange={setPanel} />
          <aside className={cn(CHROME_PANEL, 'w-[15.875rem] border-r border-border')}>
            <PanelHeader title={headers[panel].title} hint={headers[panel].hint} />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={panel}
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reducedMotion ? undefined : { opacity: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.15, ease: 'easeOut' }}
                className={cn(
                  'flex min-h-0 flex-1 flex-col',
                  // The Add panel (AddSectionBrowser, `fill`) owns its own internal
                  // scroll below a sticky search box and tabs — scrolling here too
                  // would carry that header away with the list. Every other panel
                  // (Sections tree, Theme settings) has no such header and still
                  // wants this level to scroll.
                  panel === 'add' ? 'overflow-hidden' : 'overflow-y-auto',
                )}
              >
                {panelContent}
              </motion.div>
            </AnimatePresence>
          </aside>
          <main
            id="main"
            className="relative flex min-w-0 flex-1 justify-center bg-muted px-5 pt-5 pb-16"
          >
            <div
              className={cn(
                'h-full overflow-hidden rounded-[0.625rem] bg-card shadow-popover',
                !reducedMotion && 'transition-[width] duration-200 ease-out will-change-[width]',
                DEVICE_WIDTH[device],
                loading && 'pointer-events-none opacity-60 transition-opacity duration-200',
              )}
            >
              <Puck.Preview />
            </div>
            {dock}
          </main>
          <aside className={cn(CHROME_PANEL, 'w-[17.75rem] border-l border-border')}>
            <SectionInspector settings={settings} />
          </aside>
        </div>
      </div>
      <AddSectionDialog target={inserting} onClose={() => setInserting(null)} />
    </InsertContext.Provider>
  )
}
