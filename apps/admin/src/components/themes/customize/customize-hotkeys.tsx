'use client'

import { GROUP_SECTIONS, SINGLE_SECTIONS } from '@commerce/core/theme'
import { useGetPuck } from '@puckeditor/core'
import { useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { customizeContent } from '@/data/customize'
import { deleteWithCollapse } from '@/lib/customize-canvas-motion'
import { copiedBlock, copyBlock } from '@/lib/customize-clipboard'
import { type CustomizeDoc, MAIN_ZONE } from '@/lib/customize-doc'
import { groupForZone, sectionName } from '@/lib/customize-insert'
import { useCustomizePuck } from '@/lib/customize-puck'
import { insertCopyActions, stepActions, zoneItems } from '@/lib/customize-slots'

const EDITABLE_TAGS = new Set(['input', 'textarea', 'select'])

const copy = customizeContent.clipboard

/**
 * Shortcuts on top of Puck's own, for sections and nested blocks alike:
 *
 * - Cmd/Ctrl+D duplicates the selection (Puck doesn't wire this up itself);
 * - Cmd/Ctrl+C copies it, children and all, and Cmd/Ctrl+V pastes a fresh copy
 *   (new ids) after the selection, or at the end of the template;
 * - Alt+Up / Alt+Down move it one place within its zone;
 * - Delete/Backspace is intercepted so it plays the same collapse the canvas
 *   overlay and the Sections tree use before removing (Puck's own handler, on
 *   both the admin document and the iframe, removes instantly, so this
 *   pre-empts it on the capture phase).
 *
 * Undo/redo stay Puck's global hotkeys. None of these fire while typing in a
 * field or with text selected. Renders nothing; mounted once inside `<Puck>`.
 */
export default function CustomizeHotkeys() {
  // Hooks
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const getPuck = useGetPuck()
  // Re-attaching on selection keeps the listener on the preview iframe's document,
  // which may not exist yet when the editor first mounts.
  const selectionKey = useCustomizePuck((s) => JSON.stringify(s.appState.ui.itemSelector))
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (EDITABLE_TAGS.has(target.tagName.toLowerCase()) || target.isContentEditable)

    const hasTextSelection = (e: KeyboardEvent) => {
      const doc = e.target instanceof Node ? (e.target.ownerDocument ?? document) : document
      return (doc.getSelection()?.toString() ?? '') !== ''
    }

    const current = () => {
      const puck = getPuck()
      const selector = puck.appState.ui.itemSelector
      const data = puck.appState.data as unknown as CustomizeDoc
      if (!selector) return { data, selector: null, zone: MAIN_ZONE, items: [], block: null }
      const zone = selector.zone ?? MAIN_ZONE
      const items = zoneItems(data, zone)
      return { data, selector, zone, items, block: items[selector.index] ?? null }
    }

    const labelOf = (type: string) => getPuck().config.components[type]?.label ?? type

    const handleDuplicate = (e: KeyboardEvent) => {
      const { selector, zone } = current()
      if (!selector) return
      e.preventDefault()
      dispatch({ type: 'duplicate', sourceIndex: selector.index, sourceZone: zone })
    }

    const handleCopy = (e: KeyboardEvent) => {
      const { block } = current()
      if (!block || hasTextSelection(e)) return
      e.preventDefault()
      copyBlock(block)
      toast.success(copy.copied(sectionName(block, labelOf(block.type))))
    }

    const handlePaste = (e: KeyboardEvent) => {
      const block = copiedBlock()
      if (!block) return
      e.preventDefault()
      const { data, selector, zone } = current()
      const target = selector
        ? { zone, index: selector.index + 1 }
        : { zone: MAIN_ZONE, index: zoneItems(data, MAIN_ZONE).length }
      const group = groupForZone(target.zone)
      const allowed = group
        ? GROUP_SECTIONS[group].includes(block.type)
        : !SINGLE_SECTIONS.has(block.type)
      if (!allowed) {
        toast.error(copy.cannotPaste)
        return
      }
      const count = zoneItems(data, target.zone).length
      for (const action of insertCopyActions(target, block, count)) dispatch(action)
      toast.success(copy.pasted(sectionName(block, labelOf(block.type))))
    }

    const handleMove = (e: KeyboardEvent, step: -1 | 1) => {
      const { selector, zone, items } = current()
      if (!selector) return
      e.preventDefault()
      for (const action of stepActions(zone, selector.index, items.length, step)) dispatch(action)
    }

    const handleDelete = (e: KeyboardEvent) => {
      const { selector, zone, block } = current()
      if (!selector || !block || SINGLE_SECTIONS.has(block.type)) return
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      const doc = e.target instanceof Node ? (e.target.ownerDocument ?? document) : document
      const el = doc.querySelector<HTMLElement>(`[data-puck-component="${block.props.id}"]`)
      deleteWithCollapse(dispatch, { index: selector.index, zone }, el, reducedMotion === true)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      const key = e.key.toLowerCase()
      const mod = e.metaKey || e.ctrlKey
      if (mod && key === 'd') handleDuplicate(e)
      else if (mod && key === 'c') handleCopy(e)
      else if (mod && key === 'v') handlePaste(e)
      else if (e.altKey && key === 'arrowup') handleMove(e, -1)
      else if (e.altKey && key === 'arrowdown') handleMove(e, 1)
      else if (key === 'delete' || key === 'backspace') handleDelete(e)
    }

    if (!selectionKey) return
    const docs = [document]
    const iframeDoc = document.querySelector('iframe')?.contentDocument
    if (iframeDoc) docs.push(iframeDoc)
    for (const doc of docs) doc.addEventListener('keydown', handleKeyDown, true)
    return () => {
      for (const doc of docs) doc.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [dispatch, getPuck, reducedMotion, selectionKey])

  // Render logic
  return null
}
