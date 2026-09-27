'use client'

import {
  type SectionGroup as GroupKey,
  SINGLE_SECTIONS,
  type TemplateSection,
} from '@commerce/core/theme'
import { ChevronDown } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { SortableList } from '@commerce/ui/sortable'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { customizeContent, sectionSortLabels } from '@/data/customize'
import { sectionName } from '@/lib/customize-insert'
import { useCustomizePuck } from '@/lib/customize-puck'
import AddSectionPopover from './add-section-popover'
import SectionTreeItem from './section-tree-item'

type SectionGroupProps = {
  title: string
  zone: string
  group: GroupKey | null
  sections: TemplateSection[]
}

type Item = { id: string; section: TemplateSection }

const copy = customizeContent.tree

/** Where a single drag moved one row, from the list before and after it. */
function movedIndexes(before: string[], after: string[]): { from: number; to: number } | null {
  const first = before.findIndex((id, i) => id !== after[i])
  if (first === -1) return null
  let last = before.length - 1
  while (last > first && before[last] === after[last]) last--
  return after[first] === before[last] ? { from: last, to: first } : { from: first, to: last }
}

/**
 * One block of the Sections tree (Header, Template, Footer), Shopify-style: a
 * collapsible heading with a count, the sections as draggable rows with an
 * insert line between each pair, and "+ Add section" closing the group.
 */
export default function SectionGroup({ title, zone, group, sections }: SectionGroupProps) {
  // Hooks
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const selector = useCustomizePuck((s) => s.appState.ui.itemSelector)
  const components = useCustomizePuck((s) => s.config.components)
  const reducedMotion = useReducedMotion()
  const [open, setOpen] = useState(true)
  // The rows on screen when the tree first drew; only rows added later animate in.
  const [initialIds] = useState(() => new Set(sections.map((s) => s.props.id)))

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

  // Render logic
  const items: Item[] = sections.map((section) => ({ id: section.props.id, section }))
  const count = sections.length

  return (
    <section className="flex flex-col border-border px-2 py-2 not-first:border-t">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={copy.groupToggle(title)}
        className="flex h-7 items-center gap-2 rounded-md px-2 text-left text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase transition-colors duration-150 hover:text-foreground motion-reduce:transition-none"
      >
        <span className="flex-1">{title}</span>
        <span className="rounded-full bg-muted px-1.5 text-[0.625rem] leading-4 font-medium tracking-normal tabular-nums">
          {count}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-3.5 transition-transform duration-200 motion-reduce:transition-none',
            !open && '-rotate-90',
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="rows"
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2, ease: 'easeOut' }}
            // Room at the top so the first insert line isn't clipped.
            className="-mx-1 overflow-hidden px-1 pt-1.5"
          >
            <div className="flex flex-col gap-0.5">
              {count === 0 ? (
                <p className="px-2 py-1 text-xs text-muted-foreground">{copy.empty}</p>
              ) : null}
              <SortableList
                items={items}
                onReorder={handleReorder}
                getTitle={(i) => sectionName(i.section, labelOf(i.section.type))}
                labels={sectionSortLabels}
                className="flex flex-col gap-0.5"
                renderItem={(item, { handle }) => {
                  const index = items.indexOf(item)
                  return (
                    <SectionTreeItem
                      section={item.section}
                      zone={zone}
                      group={group}
                      index={index}
                      count={count}
                      label={labelOf(item.section.type)}
                      selected={selector?.zone === zone && selector.index === index}
                      locked={SINGLE_SECTIONS.has(item.section.type)}
                      handle={handle}
                      isNew={!initialIds.has(item.id)}
                    />
                  )
                }}
              />
              <AddSectionPopover zone={zone} group={group} index={count} count={count} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
