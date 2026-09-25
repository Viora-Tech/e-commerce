'use client'

import { SINGLE_SECTIONS } from '@commerce/core/theme'
import { useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { deleteWithCollapse } from '@/lib/customize-canvas-motion'
import { type CustomizeDoc, MAIN_ZONE, zoneSections } from '@/lib/customize-doc'
import { useCustomizePuck } from '@/lib/customize-puck'

const EDITABLE_TAGS = new Set(['input', 'textarea', 'select'])

/**
 * Two shortcuts on top of Puck's own: Cmd/Ctrl+D duplicates the selected
 * section (Puck doesn't wire this up itself), and Delete/Backspace is
 * intercepted so it can play the same collapse the canvas overlay and the
 * Sections tree use before removing — Puck's own Delete/Backspace handler
 * (wired at the root `<Puck>`, active on both the admin document and the
 * iframe) removes instantly, so this pre-empts it on the capture phase.
 * Undo/redo stay untouched: they're global store hotkeys, not per-target.
 * Renders nothing; mounted once inside `<Puck>` so it can dispatch through
 * the same store as the tree and overlay.
 */
export default function CustomizeHotkeys() {
  // Hooks
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const selector = useCustomizePuck((s) => s.appState.ui.itemSelector)
  const data = useCustomizePuck((s) => s.appState.data as unknown as CustomizeDoc)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (EDITABLE_TAGS.has(target.tagName.toLowerCase()) || target.isContentEditable)

    const handleDuplicate = (e: KeyboardEvent) => {
      if (!selector || isEditableTarget(e.target)) return
      e.preventDefault()
      dispatch({
        type: 'duplicate',
        sourceIndex: selector.index,
        sourceZone: selector.zone ?? MAIN_ZONE,
      })
    }

    const handleDelete = (e: KeyboardEvent) => {
      if (!selector || isEditableTarget(e.target)) return
      const zone = selector.zone ?? MAIN_ZONE
      const section = zoneSections(data, zone)[selector.index]
      if (!section || SINGLE_SECTIONS.has(section.type)) return
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      const doc = e.target instanceof Node ? (e.target.ownerDocument ?? document) : document
      const el = doc.querySelector<HTMLElement>(`[data-puck-component="${section.props.id}"]`)
      deleteWithCollapse(dispatch, { index: selector.index, zone }, el, reducedMotion === true)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === 'd' && (e.metaKey || e.ctrlKey)) handleDuplicate(e)
      else if (key === 'delete' || key === 'backspace') handleDelete(e)
    }

    const docs = [document]
    const iframeDoc = document.querySelector('iframe')?.contentDocument
    if (iframeDoc) docs.push(iframeDoc)
    for (const doc of docs) doc.addEventListener('keydown', handleKeyDown, true)
    return () => {
      for (const doc of docs) doc.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [dispatch, selector, data, reducedMotion])

  // Render logic
  return null
}
