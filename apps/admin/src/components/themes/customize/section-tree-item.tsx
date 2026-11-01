'use client'

import type { SectionGroup, TemplateSection } from '@commerce/core/theme'
import { useGetPuck } from '@puckeditor/core'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { customizeContent } from '@/data/customize'
import { deleteWithCollapse, scrollToSection } from '@/lib/customize-canvas-motion'
import type { CustomizeDoc } from '@/lib/customize-doc'
import {
  type BlockFieldLike,
  renamedProps,
  sectionBlocks,
  sectionName,
  withBlockAdded,
  withBlockRemoved,
} from '@/lib/customize-insert'
import {
  type LiquidBlockRow,
  liquidBlockRows,
  liquidBlockTypes,
  liquidCanAddBlock,
  withLiquidBlockAdded,
  withLiquidBlockDuplicated,
  withLiquidBlockRemoved,
  withLiquidBlocksOrdered,
  withLiquidBlockToggled,
} from '@/lib/customize-liquid-tree'
import { useCustomizePuck } from '@/lib/customize-puck'
import { hasSlots, moveOutActions, slotZones } from '@/lib/customize-slots'
import { useImportedTheme, useLiquidBlocks } from '@/lib/customize-theme-context'
import AddSectionPopover from './add-section-popover'
import LiquidSectionBlocks from './liquid-section-blocks'
import SaveSectionDialog from './save-section-dialog'
import SectionBlocks from './section-blocks'
import SectionRow from './section-row'
import SlotZoneList from './slot-zone-list'

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
  /** Set for a block nested in a slot: its container's name, for "Move out of …". */
  parentName?: string | undefined
  /** How deep in slots this row sits (0 for a section in a group). */
  depth?: number | undefined
}

type SlotFields = Parameters<typeof slotZones>[1]

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
  parentName,
  depth = 0,
}: SectionTreeItemProps) {
  // Hooks
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const fields = useCustomizePuck((s) => s.config.components[section.type]?.fields)
  const getPuck = useGetPuck()
  const reducedMotion = useReducedMotion()
  const importedTheme = useImportedTheme()
  const liquidBlocks = useLiquidBlocks()
  // Containers start open, so what they hold is visible; sections with blocks start closed.
  const [open, setOpen] = useState(() => hasSlots(fields as SlotFields))
  const [savingCopy, setSavingCopy] = useState(false)

  // Helpers
  const moveTo = (to: number) => () => {
    dispatch({ type: 'reorder', sourceIndex: index, destinationIndex: to, destinationZone: zone })
    dispatch({ type: 'setUi', ui: { itemSelector: { index: to, zone } } })
  }
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

  // An imported Shopify section keeps its blocks in `props.blocks`, typed by its schema.
  const liquidSchemaOf = () =>
    importedTheme &&
    section.type === 'LiquidSection' &&
    typeof section.props.sectionType === 'string'
      ? importedTheme.schemas[section.props.sectionType]
      : undefined

  // Event handlers
  const handleSelect = () => {
    liquidBlocks.setFocus(null)
    select()
    setOpen(true)
  }

  const handleSelectLiquidBlock = (row: LiquidBlockRow) => {
    select()
    liquidBlocks.setFocus({ sectionId: section.props.id, blockId: row.id })
  }

  const handleAddLiquidBlock = (type: string) => {
    if (!importedTheme) return
    const next = withLiquidBlockAdded(section.props, type, liquidSchemaOf(), importedTheme)
    replaceProps(next)
    setOpen(true)
    select()
    const added = (next.blocks as { id: string }[]).at(-1)
    if (added) liquidBlocks.setFocus({ sectionId: section.props.id, blockId: added.id })
  }

  const handleRemoveLiquidBlock = (blockIndex: number) => {
    const removed = (section.props.blocks as { id: string }[] | undefined)?.[blockIndex]
    if (removed && liquidBlocks.focus?.blockId === removed.id) liquidBlocks.setFocus(null)
    replaceProps(withLiquidBlockRemoved(section.props, blockIndex))
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
  const zones = slotZones(section.props, fields as SlotFields)
  const liquidSchema = liquidSchemaOf()
  const liquidTypes =
    liquidSchema && importedTheme ? liquidBlockTypes(liquidSchema, importedTheme) : []
  const liquidRows = liquidSchema ? liquidBlockRows(section.props, liquidTypes) : []
  const liquidCanAdd = liquidTypes.length > 0 && liquidCanAddBlock(section.props, liquidSchema)
  const hasLiquid = liquidRows.length > 0 || liquidCanAdd
  const hasBlocks = lists.length > 0 || zones.length > 0 || hasLiquid
  const activeBlockId =
    liquidBlocks.focus?.sectionId === section.props.id ? liquidBlocks.focus.blockId : null
  const moveOut = parentName
    ? () => {
        for (const action of moveOutActions(
          getPuck().appState.data as unknown as CustomizeDoc,
          zone,
          index,
        ))
          dispatch(action)
      }
    : undefined

  return (
    <motion.div
      layout={reducedMotion ? false : 'position'}
      layoutDependency={index}
      initial={isNew && !reducedMotion ? { opacity: 0, y: -4 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }}
      className="relative"
    >
      <AddSectionPopover
        zone={zone}
        group={group}
        index={index}
        count={count}
        variant="line"
        slot={depth > 0}
      />
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
        onSaveAsSection={() => setSavingCopy(true)}
        moveOutLabel={parentName}
        onMoveOut={moveOut}
        onMoveUp={index > 0 ? moveTo(index - 1) : undefined}
        onMoveDown={index < count - 1 ? moveTo(index + 1) : undefined}
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
            {hasLiquid ? (
              <LiquidSectionBlocks
                rows={liquidRows}
                types={liquidTypes}
                canAdd={liquidCanAdd}
                activeId={activeBlockId}
                onSelect={handleSelectLiquidBlock}
                onAdd={handleAddLiquidBlock}
                onToggleHidden={(i) => replaceProps(withLiquidBlockToggled(section.props, i))}
                onDuplicate={(i) => replaceProps(withLiquidBlockDuplicated(section.props, i))}
                onRemove={handleRemoveLiquidBlock}
                onReorder={(ids) => replaceProps(withLiquidBlocksOrdered(section.props, ids))}
              />
            ) : null}
            {lists.length > 0 ? (
              <SectionBlocks
                lists={lists}
                onSelect={select}
                onAdd={handleAddBlock}
                onRemove={(key, i) => replaceProps(withBlockRemoved(section.props, key, i))}
              />
            ) : null}
            {zones.map((z) => (
              <SlotZoneList
                key={z.zone}
                zone={z.zone}
                label={zones.length > 1 ? z.label : null}
                items={z.items}
                parentName={name}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
      {savingCopy ? (
        <SaveSectionDialog
          block={section}
          defaultName={name}
          onClose={() => setSavingCopy(false)}
        />
      ) : null}
    </motion.div>
  )
}
