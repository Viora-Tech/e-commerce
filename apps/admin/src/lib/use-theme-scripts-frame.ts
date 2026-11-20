'use client'

import { isDesignModeMessage } from '@commerce/core/theme-design-mode'
import { type RefObject, useEffect, useRef, useState } from 'react'
import type { CustomizeDoc } from './customize-doc'
import { useCustomizePuck } from './customize-puck'
import { locateBlock } from './customize-slots'
import { useImportedTheme, useLiquidBlocks } from './customize-theme-context'
import { designFrameSelection, designFrameZones, puckIdForSection } from './liquid-design-frame'

/** How long edits must settle before the page re-renders (as the canvas waits, `liquid-canvas-section`). */
const SETTLE_MS = 180

/**
 * Keeps the "Theme scripts" frame in step with the editor: once the store page says it is ready
 * (and after any reload), it gets every imported section with its unsaved settings and the
 * selection, again on each change; a click on a section there selects it here. Messages go only to
 * and are taken only from `origin` and that frame.
 */
export function useThemeScriptsFrame(frame: RefObject<HTMLIFrameElement | null>, origin: string) {
  const [ready, setReady] = useState(0)
  const theme = useImportedTheme()
  const { focus, setFocus } = useLiquidBlocks()
  const doc = useCustomizePuck((s) => s.appState.data as unknown as CustomizeDoc)
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const selectedId = useCustomizePuck((s) => {
    const id = s.selectedItem?.props?.id
    return typeof id === 'string' ? id : null
  })
  const schemas = theme?.schemas ?? {}
  const message = JSON.stringify({
    type: 'theme-design:state',
    zones: designFrameZones(doc, schemas),
    selected: designFrameSelection(doc, schemas, selectedId, focus),
  })
  // The latest doc for the click handler, without re-subscribing on every edit.
  const latest = useRef({ doc, schemas })

  useEffect(() => {
    latest.current = { doc, schemas }
  })

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow) return
      if (!isDesignModeMessage(event.data)) return
      if (event.data.type === 'theme-design:ready') setReady((n) => n + 1)
      if (event.data.type !== 'theme-design:clicked') return
      const { doc: current, schemas: known } = latest.current
      const puckId = puckIdForSection(current, known, event.data.sectionId)
      const at = puckId ? locateBlock(current, puckId) : null
      if (!puckId || !at) return
      dispatch({ type: 'setUi', ui: { itemSelector: at } })
      setFocus(event.data.blockId ? { sectionId: puckId, blockId: event.data.blockId } : null)
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [frame, origin, dispatch, setFocus])

  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(
      () => frame.current?.contentWindow?.postMessage(JSON.parse(message), origin),
      SETTLE_MS,
    )
    return () => clearTimeout(timer)
  }, [frame, ready, message, origin])
}
