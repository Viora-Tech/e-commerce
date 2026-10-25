'use client'

import type { SectionGroup as GroupKey } from '@commerce/core/theme'
import { ChevronDown } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { SortableList } from '@commerce/ui/sortable'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { customizeContent, sectionSortLabels } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { CHROME_FOCUS, CHROME_TRANSITION } from '@/lib/customize-chrome'
import { type CustomizeDoc, zoneSections } from '@/lib/customize-doc'
import { sectionName } from '@/lib/customize-insert'
import { useCustomizePuck } from '@/lib/customize-puck'
import AddSectionPopover from './add-section-popover'
import SectionTreeEntry from './section-tree-entry'

type SectionGroupProps = {
  title: string
  /** The header and footer groups show on every page: a quiet chip says so. */
  everyPage?: boolean
  zone: string
  group: GroupKey | null
}

type Item = { id: string; name: string }

type Store = Parameters<Parameters<typeof useCustomizePuck>[0]>[0]

const copy = customizeContent.tree

/** The rows back from `rowsKey`. */
function itemsOf(key: string): Item[] {
  return (JSON.parse(key) as [string, string][]).map(([id, name]) => ({ id, name }))
}

/** Where a single drag moved one row, from the list before and after it. */
function movedIndexes(before: string[], after: string[]): { from: number; to: number } | null {
  const first = before.findIndex((id, i) => id !== after[i])
  if (first === -1) return null
  let last = before.length - 1
  while (last > first && before[last] === after[last]) last--
  return after[first] === before[last] ? { from: last, to: first } : { from: first, to: last }
}

/**
 * The zone's rows (id and name) as one JSON string: a store selection that only changes
 * when a section is added, removed, moved or renamed, so typing in a setting does not redraw
 * the whole tree (each row follows its own section, `SectionTreeEntry`).
 */
function rowsKey(s: Store, zone: string): string {
  return JSON.stringify(
    zoneSections(s.appState.data as unknown as CustomizeDoc, zone).map((section) => [
      section.props.id,
      sectionName(section, s.config.components[section.type]?.label ?? section.type),
    ]),
  )
}

/**
 * One block of the Layers tree (Figma 392:5543 "Section groups": "Header group · On every
 * page", "Template: Home page", "Footer group · On every page"): a collapsible 12px semibold
 * heading, the sections as draggable rows with an insert line between each pair, and
 * "+ Add section" closing the group.
 */
export default function SectionGroup({ title, everyPage, zone, group }: SectionGroupProps) {
  // Hooks
  const groups = useCopy(customizeContent.groups)
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const key = useCustomizePuck((s) => rowsKey(s, zone))
  const reducedMotion = useReducedMotion()
  const [open, setOpen] = useState(true)
  // The rows on screen when the tree first drew; only rows added later animate in.
  const [initialIds] = useState(() => new Set(itemsOf(key).map((i) => i.id)))

  // Event handlers
  const handleReorder = (next: Item[]) => {
    const moved = movedIndexes(
      items.map((i) => i.id),
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
  const items = itemsOf(key)
  const count = items.length

  return (
    <section className="flex flex-col border-border px-2 py-2 not-first:border-t not-first:border-border/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={copy.groupToggle(title)}
        className={cn(
          'group/heading flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs leading-[1.0625rem] font-semibold text-foreground',
          CHROME_TRANSITION,
          CHROME_FOCUS,
        )}
      >
        <ChevronDown
          aria-hidden
          className={cn(
            'size-3 transition-transform duration-200 motion-reduce:transition-none',
            !open && '-rotate-90',
          )}
        />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {everyPage ? (
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[0.6875rem] leading-4 font-medium text-muted-foreground">
            {groups.everyPage}
          </span>
        ) : null}
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
                <p className="px-2 py-1.5 text-xs text-muted-foreground">{copy.empty}</p>
              ) : null}
              <SortableList
                items={items}
                onReorder={handleReorder}
                getTitle={(i) => i.name}
                labels={sectionSortLabels}
                className="flex flex-col gap-0.5"
                renderItem={(item, { handle }) => {
                  const index = items.indexOf(item)
                  return (
                    <SectionTreeEntry
                      zone={zone}
                      group={group}
                      index={index}
                      count={count}
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
