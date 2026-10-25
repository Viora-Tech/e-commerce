'use client'

import type { TemplateKey } from '@commerce/core/theme'
import { Plus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Puck, useGetPuck } from '@puckeditor/core'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { type AskAiRequest, onAskAi } from '@/lib/customize-canvas-events'
import { CHROME_PANEL } from '@/lib/customize-chrome'
import type { InsertTarget } from '@/lib/customize-insert'
import { InsertContext } from '@/lib/customize-insert-context'
import { useCustomizePuck } from '@/lib/customize-puck'
import type { ResourceKind } from '@/lib/customize-resource'
import type { EditorKey } from '@/lib/customize-shortcuts'
import { EditorViewContext, useEditorViewState } from '@/lib/customize-view'
import { type CanvasZoom, CanvasZoomContext, DEVICE_PX, fitZoom } from '@/lib/customize-zoom'
import { useEditorKeys } from '@/lib/use-editor-keys'
import type { PreviewDevice } from '../theme-preview'
import AddSectionDialog from './add-section-dialog'
import AddSectionPanel from './add-section-panel'
import AiPanel from './ai-panel'
import CustomizeRail, { type RailPanel } from './customize-rail'
import FullViewExit from './full-view-exit'
import HelpPanel from './help-panel'
import PageSettingsPanel from './page-settings-panel'
import PanelIdentity from './panel-identity'
import PanelTitle from './panel-title'
import PanelToggle from './panel-toggle'
import SectionInspector from './section-inspector'
import SectionsPanel from './sections-panel'
import ShortcutsDialog from './shortcuts-dialog'

/**
 * Side panels close by narrowing to nothing (the canvas grows into the room, like a drawer)
 * while their content fades and drifts toward the edge, instead of vanishing in one frame.
 * Width is the one layout property animated here: there is no transform that hands the space
 * back to the canvas.
 */
const PANEL_SLIDE =
  'transition-[width] duration-[var(--duration-modal)] ease-drawer motion-reduce:transition-none'
const PANEL_CONTENT =
  'transition-[opacity,transform] duration-[var(--duration-popover)] ease-out motion-reduce:transition-none'

type CustomizeLayoutProps = {
  topBar: ReactNode
  /** The Theme settings panel (presets and settings groups). */
  settings: ReactNode
  /** The Pages panel: every page and template to jump between (`TemplateList`). */
  pages: ReactNode
  /** The App embeds panel: installed apps' site-wide widgets (`AppsPanel`). */
  apps: ReactNode
  /** Floating controls over the bottom of the canvas. */
  dock: ReactNode
  device: PreviewDevice
  loading: boolean
  /** The store, for the rail's tile and the left panel's "<Store> · <Template>" heading. */
  store: { id: string | null; name: string; domain: string; logoUrl: string | null }
  /** The open template's name, as the page switcher shows it. */
  templateLabel: string
  /** The open template, for Page settings. */
  template: TemplateKey
  /** The product, collection or page previewed on the canvas, for Page settings. */
  previewResource: { kind: ResourceKind; id: string | null; title: string | null } | null
  /** The AI assistant is on for this store and member (the AI tab can chat). */
  aiEnabled: boolean
  /** The theme being edited, for the AI tab: its name and whether it is live. */
  theme: { name: string; live: boolean }
}

/**
 * Shopify's three panes inside one Puck provider, Puck Cloud's rail on the
 * left: Sections / Add / Theme settings, Puck's preview in the middle, the
 * selected section's settings on the right.
 */
export default function CustomizeLayout({
  topBar,
  settings,
  pages,
  apps,
  dock,
  device,
  loading,
  store,
  templateLabel,
  template,
  previewResource,
  aiEnabled,
  theme,
}: CustomizeLayoutProps) {
  // Hooks
  const [panel, setPanel] = useState<RailPanel>('sections')
  const [aiTarget, setAiTarget] = useState<AskAiRequest | null>(null)
  const view = useEditorViewState()
  const [inserting, setInserting] = useState<InsertTarget | null>(null)
  const [shortcuts, setShortcuts] = useState(false)
  const reducedMotion = useReducedMotion()
  const panels = useCopy(customizeContent.panels)
  const identity = useCopy(customizeContent.identity)
  const [zoomMode, setZoomMode] = useState<CanvasZoom>('fit')
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const getPuck = useGetPuck()
  // Called later, on a key press, so it can use the handler declared below.
  useEditorKeys((key, e) => handleKey(key, e))
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
  // The canvas toolbar's Ask AI: the AI panel opens, aimed at that block.
  useEffect(
    () =>
      onAskAi((request) => {
        setAiTarget(request)
        setPanel('ai')
        view.setLeft(true)
      }),
    [view],
  )
  // Full view shows the page as shoppers get it: Puck's interactive mode, where a click works
  // like on the live store. Leaving it goes back to editing.
  useEffect(() => {
    const previewMode = view.full ? 'interactive' : 'edit'
    if (getPuck().appState.ui.previewMode !== previewMode)
      dispatch({ type: 'setUi', ui: { previewMode } })
  }, [dispatch, getPuck, view.full])

  // Event handlers
  /** A rail tab opens the left panel if it was hidden. */
  const openPanel = (next: RailPanel) => {
    setPanel(next)
    if (!view.left) view.setLeft(true)
  }
  /** `/` opens Add (leaving full view), `?` the shortcuts dialog (`lib/customize-shortcuts.ts`). */
  const handleKey = (key: EditorKey, e: KeyboardEvent) => {
    if (key === 'shortcuts') {
      e.preventDefault()
      setShortcuts((open) => !open)
    } else if (key === 'addSection') {
      e.preventDefault()
      if (view.full) view.setFull(false)
      openPanel('add')
    }
  }

  // Render logic
  // Pages, AI and Theme settings draw their own head (each has its own action); Add opens on
  // its switch.
  const titles: Partial<Record<RailPanel, string>> = {
    apps: panels.apps,
    settings: panels.settings,
    help: panels.help,
  }
  const title = titles[panel]
  const content: Record<RailPanel, ReactNode> = {
    add: <AddSectionPanel />,
    ai: (
      <AiPanel
        storeId={store.id}
        enabled={aiEnabled}
        page={templateLabel}
        theme={theme}
        target={aiTarget}
      />
    ),
    pages,
    sections: <SectionsPanel onOpenTheme={() => setPanel('theme')} templateLabel={templateLabel} />,
    apps,
    theme: settings,
    help: <HelpPanel />,
    settings: (
      <PageSettingsPanel
        template={template}
        templateLabel={templateLabel}
        domain={store.domain}
        resource={previewResource}
        onOpenTheme={() => setPanel('theme')}
      />
    ),
  }
  const panelContent = content[panel]

  // Full view at desktop width lays the page out at the window's own width, edge to edge;
  // tablet and phone keep their width, centred.
  const fullBleed = view.full && device === 'desktop' && room.width > 0
  const devicePx = fullBleed ? room.width : DEVICE_PX[device]
  const fit = fitZoom(devicePx, room.width)
  const zoom = fullBleed ? 1 : zoomMode === 'fit' ? fit : zoomMode
  const zoomState = { zoom, mode: zoomMode, fit, devicePx, setMode: setZoomMode }
  const resize = reducedMotion ? '' : 'duration-200 ease-out'
  const showLeft = view.left && !view.full
  const showRight = view.right && !view.full

  return (
    <EditorViewContext.Provider value={view}>
      <CanvasZoomContext.Provider value={zoomState}>
        <InsertContext.Provider value={setInserting}>
          <div data-editor-chrome="" className="flex h-svh flex-col bg-sidebar">
            {view.full ? null : topBar}
            <div className={cn('flex min-h-0 flex-1', !view.full && 'border-t border-border')}>
              {view.full ? null : (
                <CustomizeRail active={panel} onChange={openPanel} store={store} />
              )}
              <aside
                inert={!showLeft}
                aria-hidden={!showLeft}
                className={cn(
                  CHROME_PANEL,
                  PANEL_SLIDE,
                  showLeft ? 'w-[19rem] border-r border-border' : 'w-0',
                )}
              >
                <div
                  className={cn(
                    'flex min-h-0 w-[19rem] flex-1 flex-col',
                    PANEL_CONTENT,
                    !showLeft && '-translate-x-3 opacity-0',
                  )}
                >
                  {panel === 'add' || panel === 'sections' ? (
                    <PanelIdentity
                      title={identity.title(store.name, templateLabel)}
                      domain={store.domain}
                    />
                  ) : null}
                  {panel === 'sections' ? (
                    <PanelTitle
                      size="md"
                      title={panels.sections}
                      action={
                        <Button variant="outline" onClick={() => setPanel('add')}>
                          <Plus aria-hidden />
                          {panels.addSection}
                        </Button>
                      }
                    />
                  ) : null}
                  {title ? <PanelTitle title={title} /> : null}
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={panel}
                      initial={reducedMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={reducedMotion ? undefined : { opacity: 0 }}
                      transition={{ duration: reducedMotion ? 0 : 0.15, ease: 'easeOut' }}
                      className={cn(
                        'flex min-h-0 flex-1 flex-col',
                        // The Add panel sits in the panel's own 16px gutter (Figma 369:4899).
                        panel === 'add' && 'px-4 pt-4',
                        // The Add panel (AddSectionBrowser, `fill`) owns its own internal
                        // scroll below a sticky search box and tabs — scrolling here too
                        // would carry that header away with the list. Every other panel
                        // (Sections tree, Theme settings) has no such header and still
                        // wants this level to scroll.
                        panel === 'add' || panel === 'pages' || panel === 'ai'
                          ? 'overflow-hidden'
                          : 'overflow-y-auto',
                      )}
                    >
                      {panelContent}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </aside>
              <main id="main" className="relative flex min-w-0 flex-1 bg-muted">
                {/* The page is laid out at the device's real width and scaled (CSS transform) to
                the zoom; the outer box takes the scaled size, so a zoom wider than the space
                scrolls sideways. Inside the canvas everything keeps its own coordinates. */}
                <div
                  ref={setStage}
                  data-canvas-stage=""
                  className={cn(
                    'flex min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden',
                    !view.full && 'px-6 pt-8 pb-16',
                  )}
                >
                  <div
                    style={{ width: devicePx * zoom, height: room.height }}
                    className={cn(
                      'mx-auto shrink-0 overflow-hidden bg-card',
                      !fullBleed && 'rounded-[0.625rem] shadow-popover',
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
                {view.full ? null : (
                  <>
                    {dock}
                    <PanelToggle side="left" />
                    <PanelToggle side="right" />
                  </>
                )}
                <FullViewExit />
              </main>
              <aside
                inert={!showRight}
                aria-hidden={!showRight}
                data-inspector=""
                className={cn(
                  CHROME_PANEL,
                  PANEL_SLIDE,
                  showRight ? 'w-[21.25rem] border-l border-border' : 'w-0',
                )}
              >
                <div
                  className={cn(
                    'flex min-h-0 w-[21.25rem] flex-1 flex-col',
                    PANEL_CONTENT,
                    !showRight && 'translate-x-3 opacity-0',
                  )}
                >
                  <SectionInspector />
                </div>
              </aside>
            </div>
          </div>
          <AddSectionDialog target={inserting} onClose={() => setInserting(null)} />
          <ShortcutsDialog open={shortcuts} onOpenChange={setShortcuts} />
        </InsertContext.Provider>
      </CanvasZoomContext.Provider>
    </EditorViewContext.Provider>
  )
}
