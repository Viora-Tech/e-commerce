'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Puck } from '@puckeditor/core'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { CHROME_PANEL } from '@/lib/customize-chrome'
import type { InsertTarget } from '@/lib/customize-insert'
import { InsertContext } from '@/lib/customize-insert-context'
import { type CanvasZoom, CanvasZoomContext, DEVICE_PX, fitZoom } from '@/lib/customize-zoom'
import type { PreviewDevice } from '../theme-preview'
import AddSectionDialog from './add-section-dialog'
import AddSectionPanel from './add-section-panel'
import CustomizeRail, { type RailPanel } from './customize-rail'
import PanelHeader from './panel-header'
import SectionInspector from './section-inspector'
import SectionsPanel from './sections-panel'

type CustomizeLayoutProps = {
  topBar: ReactNode
  /** The Theme settings panel (presets and settings groups). */
  settings: ReactNode
  /** Floating controls over the bottom of the canvas. */
  dock: ReactNode
  device: PreviewDevice
  loading: boolean
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
  const [zoomMode, setZoomMode] = useState<CanvasZoom>('fit')
  // The canvas area's inner size: Fit scales the page into its width, and the frame fills
  // its height.
  const [stage, setStage] = useState<HTMLDivElement | null>(null)
  const [room, setRoom] = useState({ width: 0, height: 0 })
  useEffect(() => {
    if (!stage) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      setRoom((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [stage])

  // Render logic
  const headers: Record<RailPanel, { title: string; hint: string }> = {
    sections: { title: panels.sections, hint: panels.sectionsHint },
    add: { title: panels.add, hint: panels.addHint },
    theme: { title: panels.theme, hint: panels.themeHint },
  }
  const panelContent =
    panel === 'theme' ? (
      settings
    ) : panel === 'add' ? (
      <AddSectionPanel />
    ) : (
      <SectionsPanel onOpenTheme={() => setPanel('theme')} />
    )

  const devicePx = DEVICE_PX[device]
  const fit = fitZoom(devicePx, room.width)
  const zoom = zoomMode === 'fit' ? fit : zoomMode
  const zoomState = { zoom, mode: zoomMode, fit, devicePx, setMode: setZoomMode }
  const resize = reducedMotion ? '' : 'duration-200 ease-out'

  return (
    <CanvasZoomContext.Provider value={zoomState}>
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
            <main id="main" className="relative flex min-w-0 flex-1 bg-muted">
              {/* The page is laid out at the device's real width and scaled (CSS transform) to
                the zoom; the outer box takes the scaled size, so a zoom wider than the space
                scrolls sideways. Inside the canvas everything keeps its own coordinates. */}
              <div
                ref={setStage}
                data-canvas-stage=""
                className="flex min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden px-5 pt-5 pb-16"
              >
                <div
                  style={{ width: devicePx * zoom, height: room.height }}
                  className={cn(
                    'mx-auto shrink-0 overflow-hidden rounded-[0.625rem] bg-card shadow-popover',
                    resize && `transition-[width] ${resize}`,
                    room.width === 0 && 'invisible',
                    loading && 'pointer-events-none opacity-60 transition-opacity duration-200',
                  )}
                >
                  <div
                    style={{
                      width: devicePx,
                      height: room.height / zoom,
                      transform: `scale(${zoom})`,
                    }}
                    className={cn(
                      'origin-top-left',
                      resize && `transition-[width,transform] ${resize}`,
                    )}
                  >
                    <Puck.Preview />
                  </div>
                </div>
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
    </CanvasZoomContext.Provider>
  )
}
