'use client'

import { useGetPuck } from '@puckeditor/core'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import {
  type CustomizeDoc,
  FOOTER_ZONE,
  HEADER_ZONE,
  MAIN_ZONE,
  zoneSections,
} from '@/lib/customize-doc'
import { sectionName } from '@/lib/customize-insert'
import { useCustomizePuck } from '@/lib/customize-puck'

const ROOT_ZONES = [HEADER_ZONE, MAIN_ZONE, FOOTER_ZONE]

/** Every top-level section of a page, by id. */
function sectionsOf(doc: CustomizeDoc) {
  return new Map(ROOT_ZONES.flatMap((zone) => zoneSections(doc, zone)).map((s) => [s.props.id, s]))
}

/**
 * "Testimonials removed · Undo" (Figma 697:2969): when a new history step takes a section off
 * the page (the canvas trash, the Layers row, Delete), a toast offers Undo, which steps back
 * once and puts it where it was. Undo and redo themselves never toast. Renders nothing.
 */
export default function SectionRemovedToast() {
  // Hooks
  const copy = useCopy(customizeContent.removed)
  const getPuck = useGetPuck()
  const index = useCustomizePuck((s) => s.history.index)
  const doc = useCustomizePuck((s) => s.appState.data) as unknown as CustomizeDoc
  const seen = useRef<{ index: number; doc: CustomizeDoc } | null>(null)

  useEffect(() => {
    const before = seen.current
    seen.current = { index, doc }
    // Only a new step forward can be a removal; undo and redo move the index the other way
    // or replay a step the merchant already saw.
    if (!before || index <= before.index) return
    const now = sectionsOf(doc)
    const gone = [...sectionsOf(before.doc).values()].filter((s) => !now.has(s.props.id))
    const removed = gone[0]
    if (gone.length !== 1 || !removed) return
    const puck = getPuck()
    const label = puck.config.components[removed.type]?.label ?? removed.type
    toast.success(copy.title(sectionName(removed, label)), {
      description: copy.body,
      action: { label: copy.undo, onClick: () => getPuck().history.back() },
    })
  }, [index, doc, getPuck, copy])

  // Render logic
  return null
}
