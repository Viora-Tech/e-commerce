'use client'

import { type ReactNode, useContext } from 'react'
import { editorOverlayContent as copy } from '../data/editor-overlay'
import { EditorSelectionContext } from '../editor-selection'

type EditorOverlayProps = {
  /** The section's Puck id, compared with the item selected in the sidebar. */
  id: string | undefined
  /** What the strip calls the section ("Signup popup"). */
  label: string
  /** When it shows on the store ("after 20 seconds"); optional. */
  when?: string | undefined
  /** The overlay as shoppers see it, drawn only while the section is selected. */
  children: ReactNode
}

/**
 * SOURCE OF TRUTH: editor preview of overlay sections (popups, cookie banner) — WHAT keeps
 * things that float over the page on the store from being drawn open, stacked in the canvas
 * / WHY in the canvas every section renders in place, so popups piled up after the footer.
 * Unselected, the section is a slim labelled strip; selected in the sidebar, its real
 * overlay opens over the canvas, like Shopify's theme editor.
 */
export default function EditorOverlay({ id, label, when, children }: EditorOverlayProps) {
  // Hooks
  const selectedId = useContext(EditorSelectionContext)

  // Derived
  const selected = id !== undefined && selectedId === id

  // Render logic
  if (selected) return <>{children}</>
  return (
    <div className="editor-overlay">
      <span className="editor-overlay__label">{label}</span>
      <span className="editor-overlay__hint">{copy.hint(when)}</span>
    </div>
  )
}
