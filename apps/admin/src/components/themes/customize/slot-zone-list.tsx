'use client'

import type { TemplateSection } from '@commerce/core/theme'
import { cn } from '@commerce/ui/lib/utils'
import { SortableList } from '@commerce/ui/sortable'
import { useState } from 'react'
import { customizeContent, sectionSortLabels } from '@/data/customize'
import { CHROME_META } from '@/lib/customize-chrome'
import { sectionName } from '@/lib/customize-insert'
import { useCustomizePuck } from '@/lib/customize-puck'
import { reorderActions } from '@/lib/customize-slots'
import AddSectionPopover from './add-section-popover'
import SectionTreeItem from './section-tree-item'

type SlotZoneListProps = {
  /** Puck zone of the slot: `<parentId>:<propPath>`. */
  zone: string
  /** Shown above the rows when the block has several slots ("Column 2", "Tab: Shipping"). */
  label: string | null
  items: TemplateSection[]
  /** Name of the container, for "Move out of …". */
  parentName: string
  depth: number
}

type Item = { id: string; section: TemplateSection }

const copy = customizeContent.tree

/**
 * One slot of a container in the Sections tree: its blocks as draggable rows
 * (reordering is a Puck `reorder` on the slot's zone), an insert line between
 * rows and "Add block" at the end. Rows are full tree items, so containers
 * nest to any depth. The hairline on the left is the indent guide.
 */
export default function SlotZoneList({ zone, label, items, parentName, depth }: SlotZoneListProps) {
  // Hooks
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const selector = useCustomizePuck((s) => s.appState.ui.itemSelector)
  const components = useCustomizePuck((s) => s.config.components)
  const [initialIds] = useState(() => new Set(items.map((s) => s.props.id)))

  // Helpers
  const labelOf = (type: string) => components[type]?.label ?? type

  // Event handlers
  const handleReorder = (next: Item[]) => {
    const actions = reorderActions(
      zone,
      items.map((s) => s.props.id),
      next.map((i) => i.id),
    )
    for (const action of actions) dispatch(action)
  }

  // Render logic
  const rows: Item[] = items.map((section) => ({ id: section.props.id, section }))
  const count = items.length

  return (
    <div className="ml-6 flex flex-col border-l border-border/80 pl-1.5">
      {label ? <p className={cn('px-2 pt-1.5 pb-0.5', CHROME_META)}>{label}</p> : null}
      {count === 0 ? (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">{copy.emptySlot}</p>
      ) : null}
      <SortableList
        items={rows}
        onReorder={handleReorder}
        getTitle={(i) => sectionName(i.section, labelOf(i.section.type))}
        labels={sectionSortLabels}
        className="flex flex-col gap-0.5 pt-1"
        renderItem={(item, { handle }) => {
          const index = rows.indexOf(item)
          return (
            <SectionTreeItem
              section={item.section}
              zone={zone}
              group={null}
              index={index}
              count={count}
              label={labelOf(item.section.type)}
              selected={selector?.zone === zone && selector.index === index}
              locked={false}
              handle={handle}
              isNew={!initialIds.has(item.id)}
              parentName={parentName}
              depth={depth}
            />
          )
        }}
      />
      <AddSectionPopover zone={zone} group={null} index={count} count={count} slot />
    </div>
  )
}
