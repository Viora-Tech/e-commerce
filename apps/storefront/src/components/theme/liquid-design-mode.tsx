'use client'

import {
  type DesignModeSelection,
  type DesignModeState,
  isDesignModeMessage,
} from '@commerce/core/theme-design-mode'
import { THEME_PREVIEW_PARAM } from '@commerce/core/theme-preview'
import { useEffect } from 'react'
import {
  clickTarget,
  placeSection,
  planDesignUpdate,
  removeSection,
  reorderSections,
  selectionEvents,
} from '@/lib/liquid-design-mode'

type LiquidDesignModeProps = {
  /** The admin's origin; the only sender whose messages are applied, the only one told of clicks. */
  adminOrigin: string
}

/** Renders the editor's sections here, with their unsaved settings (`lib/liquid-editor-sections.ts`). */
async function renderSections(
  token: string,
  sections: DesignModeState['zones'][string],
): Promise<Record<string, string>> {
  if (sections.length === 0) return {}
  const res = await fetch(
    `/theme-actions/editor-sections?${THEME_PREVIEW_PARAM}=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        path: window.location.pathname,
        sections: sections.map((s) => s.placement),
      }),
    },
  )
  if (!res.ok) throw new Error(`editor sections ${res.status}`)
  return (await res.json()) as Record<string, string>
}

/**
 * The storefront half of Customize's "Theme scripts" canvas. Mounted only on a page the proxy
 * opened in design mode (a verified preview token, in a frame, `?theme-design-mode=1`): the
 * theme's own scripts run here on the store's address, never in the admin, and this applies what
 * the editor sends, firing Shopify's theme editor events (`lib/liquid-design-mode.ts`). A click on
 * a section tells the editor to select it; links and forms stay on the page.
 */
export default function LiquidDesignMode({ adminOrigin }: LiquidDesignModeProps) {
  // Hooks
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get(THEME_PREVIEW_PARAM)
    if (!token || window.parent === window) return
    let known = new Map<string, string>()
    let selected: DesignModeSelection = null
    let queue = Promise.resolve()

    const apply = async (state: DesignModeState) => {
      const plan = planDesignUpdate(known, selected, state)
      for (const id of plan.remove) removeSection(document, id)
      const html = await renderSections(token, plan.render).catch(() => null)
      const next = new Map(plan.known)
      for (const sections of Object.values(state.zones)) {
        const order = sections.map((s) => s.id)
        for (const s of plan.render.filter((r) => order.includes(r.id))) {
          const part = html?.[s.id]
          if (part) placeSection(document, s, part, order)
          // Not drawn: try again on the next message.
          else if (known.has(s.id)) next.set(s.id, known.get(s.id) ?? '')
          else next.delete(s.id)
        }
        reorderSections(document, order)
      }
      selectionEvents(document, plan.deselect, false)
      selectionEvents(document, plan.select, true)
      known = next
      selected = state.selected
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== adminOrigin || !isDesignModeMessage(event.data)) return
      if (event.data.type !== 'theme-design:state') return
      const state = event.data
      queue = queue.then(() => apply(state)).catch(() => undefined)
    }
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('a[href]')) event.preventDefault()
      const hit = clickTarget(target)
      if (!hit) return
      window.parent.postMessage({ type: 'theme-design:clicked', ...hit }, adminOrigin)
    }
    const handleSubmit = (event: SubmitEvent) => event.preventDefault()

    window.addEventListener('message', handleMessage)
    document.addEventListener('click', handleClick, true)
    document.addEventListener('submit', handleSubmit, true)
    window.parent.postMessage({ type: 'theme-design:ready' }, adminOrigin)
    return () => {
      window.removeEventListener('message', handleMessage)
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('submit', handleSubmit, true)
    }
  }, [adminOrigin])

  // Render logic
  return null
}
