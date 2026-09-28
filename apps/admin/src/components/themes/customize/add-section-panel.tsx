'use client'

import { type CustomizeDoc, MAIN_ZONE, zoneSections } from '@/lib/customize-doc'
import { useCustomizePuck } from '@/lib/customize-puck'
import AddSectionBrowser from './add-section-browser'

/**
 * The rail's persistent Add panel. Unlike the tree's per-group popover, this
 * isn't scoped to one zone — clicking a card appends to the Template zone
 * (dragging a card still drops wherever it's released, including the header
 * or footer zone, since that's Puck's own drop-target detection, not ours).
 */
export default function AddSectionPanel() {
  // Hooks
  const data = useCustomizePuck((s) => s.appState.data as unknown as CustomizeDoc)

  // Render logic
  const count = zoneSections(data, MAIN_ZONE).length

  return (
    // Sticky category headings paint the surface they sit on: card here, popover elsewhere.
    <div className="flex min-h-0 flex-1 flex-col [--add-surface:var(--card)]">
      <AddSectionBrowser zone={MAIN_ZONE} group={null} index={count} count={count} fill />
    </div>
  )
}
