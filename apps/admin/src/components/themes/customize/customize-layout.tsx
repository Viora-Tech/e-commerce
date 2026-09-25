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

/** Side panels float as rounded cards on the tinted editor backdrop. */
const FLOATING_PANEL =
  'flex shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card'

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
  const reducedMotion = useReducedMotion()

  // Render logic
  const panelContent =
    panel === 'theme' ? settings : panel === 'add' ? <AddSectionPanel /> : <SectionsTree />

  return (
    <div className="flex h-svh flex-col bg-sidebar">
      {topBar}
      <div className="flex min-h-0 flex-1 gap-2 px-2 pb-2">
        <CustomizeRail active={panel} onChange={setPanel} />
        <aside className={cn(FLOATING_PANEL, 'w-64')}>
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
        <main
          id="main"
          className="relative flex min-w-0 flex-1 justify-center rounded-2xl bg-muted bg-[image:radial-gradient(var(--border-strong)_1px,transparent_1px)] [background-size:1rem_1rem] px-4 pt-4 pb-16"
        >
          <div
            className={cn(
              'h-full overflow-hidden rounded-xl bg-card shadow-popover ring-1 ring-border',
              !reducedMotion && 'transition-[width] duration-300 ease-out will-change-[width]',
              DEVICE_WIDTH[device],
              loading && 'pointer-events-none opacity-60 transition-opacity duration-200',
            )}
          >
            <Puck.Preview />
          </div>
          {dock}
        </main>
        <aside className={cn(FLOATING_PANEL, 'w-[20rem]')}>
          <SectionInspector settings={settings} />
        </aside>
      </div>
    </div>
  )
}
