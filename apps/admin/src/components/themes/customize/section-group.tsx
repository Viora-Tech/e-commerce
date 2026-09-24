'use client'

import {
  type SectionGroup as GroupKey,
  SINGLE_SECTIONS,
  type TemplateSection,
} from '@commerce/core/theme'
import { SortableList } from '@commerce/ui/sortable'
import { sectionSortLabels } from '@/data/customize'
import { useCustomizePuck } from '@/lib/customize-puck'
import AddSectionPopover from './add-section-popover'
import SectionRow from './section-row'

type SectionGroupProps = {
  title: string
  zone: string
  group: GroupKey | null
  sections: TemplateSection[]
}

type Item = { id: string; section: TemplateSection }

/** Where a single drag moved one row, from the list before and after it. */
function movedIndexes(before: string[], after: string[]): { from: number; to: number } | null {
  const first = before.findIndex((id, i) => id !== after[i])
  if (first === -1) return null
  let last = before.length - 1
  while (last > first && before[last] === after[last]) last--
  return after[first] === before[last] ? { from: last, to: first } : { from: first, to: last }
}

/**
 * One block of the Sections tree (header group, template, footer group). Every
 * change is a Puck action, so selection, undo and the preview stay in step.
 */
export default function SectionGroup({ title, zone, group, sections }: SectionGroupProps) {
  // Hooks
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const selector = useCustomizePuck((s) => s.appState.ui.itemSelector)
  const components = useCustomizePuck((s) => s.config.components)

  // Helpers
  const labelOf = (type: string) => components[type]?.label ?? type

  // Event handlers
  const handleReorder = (next: Item[]) => {
    const moved = movedIndexes(
      sections.map((s) => s.props.id),
      next.map((i) => i.id),
    )
    if (!moved) return
    dispatch({
      type: 'reorder',
      sourceIndex: moved.from,
      destinationIndex: moved.to,
      destinationZone: zone,
    })
    dispatch({ type: 'setUi', ui: { itemSelector: { index: moved.to, zone } } })
  }

  const handleToggle = (index: number, section: TemplateSection) =>
    dispatch({
      type: 'replace',
      destinationIndex: index,
      destinationZone: zone,
      data: { ...section, props: { ...section.props, _hidden: section.props._hidden !== true } },
    })

  // Render logic
  const items: Item[] = sections.map((section) => ({ id: section.props.id, section }))
  return (
    <section className="flex flex-col gap-0.5 border-b border-border px-2 py-3">
      <h2 className="text-eyebrow px-2 pb-1">{title}</h2>
      <SortableList
        items={items}
        onReorder={handleReorder}
        getTitle={(i) => labelOf(i.section.type)}
        labels={sectionSortLabels}
        renderItem={(item, { handle }) => {
          const index = items.indexOf(item)
          return (
            <SectionRow
              section={item.section}
              label={labelOf(item.section.type)}
              selected={selector?.zone === zone && selector.index === index}
              locked={SINGLE_SECTIONS.has(item.section.type)}
              handle={handle}
              onSelect={() => dispatch({ type: 'setUi', ui: { itemSelector: { index, zone } } })}
              onToggleHidden={() => handleToggle(index, item.section)}
              onDuplicate={() =>
                dispatch({ type: 'duplicate', sourceIndex: index, sourceZone: zone })
              }
              onRemove={() => dispatch({ type: 'remove', index, zone })}
            />
          )
        }}
      />
      <AddSectionPopover zone={zone} group={group} count={sections.length} />
    </section>
  )
}
