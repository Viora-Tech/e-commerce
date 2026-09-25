'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Puck } from '@puckeditor/core'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import type { PreviewDevice } from '../theme-preview'
import AddSectionPanel from './add-section-panel'
import CustomizeRail, { type RailPanel } from './customize-rail'
import SectionInspector from './section-inspector'
import SectionsTree from './sections-tree'

type CustomizeLayoutProps = {
  topBar: ReactNode
  /** The Theme settings panel (presets and settings groups). */
  settings: ReactNode
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
  device,
  loading,
}: CustomizeLayoutProps) {
  // Hooks
  const [panel, setPanel] = useState<RailPanel>('sections')
  const reducedMotion = useReducedMotion()

  // Render logic
  const panelContent =
    panel === 'theme' ? settings : panel === 'add' ? <AddSectionPanel /> : <SectionsTree />

  return (
    <div className="flex h-svh flex-col bg-background">
      {topBar}
      <div className="flex min-h-0 flex-1">
        <CustomizeRail active={panel} onChange={setPanel} />
        <aside className="flex w-64 shrink-0 flex-col overflow-hidden border-r border-border bg-card">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={panel}
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.16, ease: 'easeOut' }}
              className="flex min-h-0 flex-1 flex-col overflow-y-auto"
            >
              {panelContent}
            </motion.div>
          </AnimatePresence>
        </aside>
        <main id="main" className="flex min-w-0 flex-1 justify-center bg-muted p-3">
          <div
            className={cn(
              'h-full overflow-hidden rounded-lg bg-card shadow-sm',
              !reducedMotion && 'transition-[width] duration-300 ease-out will-change-[width]',
              DEVICE_WIDTH[device],
              loading && 'pointer-events-none opacity-60 transition-opacity duration-200',
            )}
          >
            <Puck.Preview />
          </div>
        </main>
        <aside className="flex w-[20rem] shrink-0 flex-col border-l border-border bg-card">
          <SectionInspector settings={settings} />
        </aside>
      </div>
    </div>
  )
}
