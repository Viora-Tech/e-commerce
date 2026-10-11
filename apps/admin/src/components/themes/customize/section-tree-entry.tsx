'use client'

import { type SectionGroup, SINGLE_SECTIONS } from '@commerce/core/theme'
import type { ReactNode } from 'react'
import { type CustomizeDoc, zoneSections } from '@/lib/customize-doc'
import { useCustomizePuck } from '@/lib/customize-puck'
import SectionTreeItem from './section-tree-item'

type SectionTreeEntryProps = {
  zone: string
  group: SectionGroup | null
  index: number
  count: number
  handle: ReactNode
  isNew: boolean
}

/**
 * A row of a Layers group, following its own section in the Puck store: Puck keeps an
 * unedited section the same object, so an edit redraws the edited row and not its
 * neighbours, and a selection redraws the two rows it moves between.
 */
export default function SectionTreeEntry({
  zone,
  group,
  index,
  count,
  handle,
  isNew,
}: SectionTreeEntryProps) {
  // Hooks
  const section = useCustomizePuck(
    (s) => zoneSections(s.appState.data as unknown as CustomizeDoc, zone)[index],
  )
  const label = useCustomizePuck((s) =>
    section ? (s.config.components[section.type]?.label ?? section.type) : '',
  )
  const selected = useCustomizePuck(
    (s) => s.appState.ui.itemSelector?.zone === zone && s.appState.ui.itemSelector.index === index,
  )

  // Early returns
  if (!section) return null

  return (
    <SectionTreeItem
      section={section}
      zone={zone}
      group={group}
      index={index}
      count={count}
      label={label}
      selected={selected}
      locked={SINGLE_SECTIONS.has(section.type)}
      handle={handle}
      isNew={isNew}
    />
  )
}
