'use client'

import type { SectionGroup, TemplateSection } from '@commerce/core/theme'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { customizeContent } from '@/data/customize'
import { deleteWithCollapse, scrollToSection } from '@/lib/customize-canvas-motion'
import {
  type BlockFieldLike,
  renamedProps,
  sectionBlocks,
  sectionName,
  withBlockAdded,
  withBlockRemoved,
} from '@/lib/customize-insert'
import { useCustomizePuck } from '@/lib/customize-puck'
import AddSectionPopover from './add-section-popover'
import SectionBlocks from './section-blocks'
import SectionRow from './section-row'

type SectionTreeItemProps = {
  section: TemplateSection
  zone: string
  group: SectionGroup | null
  index: number
  count: number
  label: string
  selected: boolean
  locked: boolean
  handle: ReactNode
  /** A row added after the tree mounted slides in; the ones there at load don't. */
  isNew: boolean
}

/**
 * One entry of the Sections tree: the insert line above it (a "+" between
 * this section and the one before), the row itself, and its blocks. Every
 * change is a Puck action, so selection, undo and the preview stay in step.
 */
export default function SectionTreeItem({
  section,
  zone,
  group,
  index,
  count,
  label,
  selected,
  locked,
  handle,
  isNew,
}: SectionTreeItemProps) {
  // Hooks
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const fields = useCustomizePuck((s) => s.config.components[section.type]?.fields)
  const reducedMotion = useReducedMotion()
  const [open, setOpen] = useState(false)

  // Helpers
  const replaceProps = (props: Record<string, unknown>) =>
    dispatch({
      type: 'replace',
      destinationIndex: index,
      destinationZone: zone,
      data: { ...section, props: { ...props, id: section.props.id } },
    })

  const select = () => {
    dispatch({ type: 'setUi', ui: { itemSelector: { index, zone } } })
    scrollToSection(section.props.id, reducedMotion === true)
  }

  // Event handlers
  const handleSelect = () => {
    select()
    setOpen(true)
  }

  const handleAddBlock = (key: string) => {
    const field = (fields as Record<string, BlockFieldLike> | undefined)?.[key]
    if (!field) return
    replaceProps(withBlockAdded(section.props, key, field))
    setOpen(true)
    select()
  }

  // Render logic
  const name = sectionName(section, label)
  const lists = sectionBlocks(
    section.props,
    fields as Record<string, BlockFieldLike> | undefined,
    customizeContent.array.itemFallback,
  )
  const hasBlocks = lists.length > 0

  return (
    <motion.div
      layout={reducedMotion ? false : 'position'}
      layoutDependency={index}
      initial={isNew && !reducedMotion ? { opacity: 0, y: -4 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }}
      className="relative"
    >
      <AddSectionPopover zone={zone} group={group} index={index} count={count} variant="line" />
      <SectionRow
        section={section}
        name={name}
        selected={selected}
        locked={locked}
        handle={handle}
        blocksOpen={hasBlocks ? open : null}
        onToggleBlocks={() => setOpen((v) => !v)}
        onSelect={handleSelect}
        onToggleHidden={() =>
          replaceProps({ ...section.props, _hidden: section.props._hidden !== true })
        }
        onDuplicate={() => dispatch({ type: 'duplicate', sourceIndex: index, sourceZone: zone })}
        onRename={(next) => replaceProps(renamedProps(section.props, next, label))}
        onRemove={(el) =>
          deleteWithCollapse(
            dispatch,
            { index, zone },
            el?.closest('li') ?? el,
            reducedMotion === true,
          )
        }
      />
      <AnimatePresence initial={false}>
        {hasBlocks && open ? (
          <motion.div
            key="blocks"
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <SectionBlocks
              lists={lists}
              onSelect={select}
              onAdd={handleAddBlock}
              onRemove={(key, i) => replaceProps(withBlockRemoved(section.props, key, i))}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}
