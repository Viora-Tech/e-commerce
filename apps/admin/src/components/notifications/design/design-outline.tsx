'use client'

import type { EmailTemplateDesign, FreeBlockType } from '@commerce/notifications/design'
import { GripVertical } from '@commerce/ui/icons'
import { useDndSensors } from '@commerce/ui/sortable'
import {
  type Announcements,
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type Modifier,
  pointerWithin,
} from '@dnd-kit/core'
import { useId, useState } from 'react'
import { emailDesignContent } from '@/data/email-design'
import { useCopy } from '@/hooks/use-copy'
import DesignBlockList from './design-block-list'
import { applyDrop, dropIndex, END_ZONE_ID, paletteType } from './design-drop'
import DesignPalette from './design-palette'
import { addBlock, blockTitle, canAdd, duplicateBlock, newBlock, removeBlock } from './design-state'

type DesignOutlineProps = {
  design: EmailTemplateDesign
  variables: readonly string[]
  selected: string | null
  onSelect: (id: string | null) => void
  onChange: (design: EmailTemplateDesign) => void
}

/** Rows only move up and down; a new block from the palette follows the pointer freely. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

/** A row being moved snaps to the nearest row; a new block lands only where the pointer is. */
const collision: CollisionDetection = (args) =>
  paletteType(args.active.id) ? pointerWithin(args) : closestCenter(args)

/**
 * "Add a block" and the email's blocks in one drag area, like Shopify's email editor: drag a
 * tile from the palette into the list, drag rows to reorder, duplicate or remove a row. The
 * keyboard moves rows (Space, arrows, Space) and adds blocks with Enter on a tile.
 */
export default function DesignOutline({
  design,
  variables,
  selected,
  onSelect,
  onChange,
}: DesignOutlineProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)
  const sensors = useDndSensors()
  /* A stable id keeps dnd-kit's aria-describedby the same on the server and the client. */
  const dndId = useId()
  const [adding, setAdding] = useState<FreeBlockType | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  // Helpers
  const titleOf = (id: unknown) => {
    const type = paletteType(id)
    if (type) return copy.blocks[type]
    const block = design.blocks.find((b) => b.id === id)
    return block ? blockTitle(block, copy) : ''
  }

  const positionOf = (id: unknown) => {
    const at = dropIndex(design, id)
    return at === -1 ? 0 : at + 1
  }

  const resetDrag = () => {
    setAdding(null)
    setOverId(null)
  }

  // Event handlers
  const handleAdd = (type: FreeBlockType) => {
    const block = newBlock(type)
    const next = addBlock(design, block, selected ?? undefined)
    if (next === design) return
    onChange(next)
    onSelect(block.id)
  }

  const handleRemove = (id: string) => {
    onChange(removeBlock(design, id))
    if (selected === id) onSelect(null)
  }

  const handleDuplicate = (id: string) => {
    const result = duplicateBlock(design, id)
    if (!result.id) return
    onChange(result.design)
    onSelect(result.id)
  }

  const handleDragOver = ({ over }: DragOverEvent) => {
    setOverId(over ? String(over.id) : null)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    resetDrag()
    const result = applyDrop(design, active.id, over?.id ?? null)
    if (result.design === design) return
    onChange(result.design)
    if (result.added) onSelect(result.added)
  }

  // Render logic
  const full = !canAdd(design)
  const total = design.blocks.length
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      paletteType(active.id)
        ? copy.sortable.newPicked(titleOf(active.id))
        : copy.sortable.picked(titleOf(active.id)),
    onDragOver: ({ active, over }) => {
      if (!over) return ''
      return paletteType(active.id)
        ? copy.sortable.newOver(titleOf(active.id), positionOf(over.id), total + 1)
        : copy.sortable.moved(titleOf(active.id), positionOf(over.id), total)
    },
    onDragEnd: ({ active, over }) => {
      if (!over) return ''
      return paletteType(active.id)
        ? copy.sortable.newDropped(titleOf(active.id), positionOf(over.id), total + 1)
        : copy.sortable.dropped(titleOf(active.id), positionOf(over.id), total)
    },
    onDragCancel: ({ active }) =>
      paletteType(active.id)
        ? copy.sortable.newCancelled(titleOf(active.id))
        : copy.sortable.cancelled(titleOf(active.id)),
  }
  const insertBefore = adding && overId !== END_ZONE_ID ? overId : null

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={collision}
      modifiers={adding ? [] : [verticalOnly]}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: copy.sortable.instructions },
      }}
      onDragStart={({ active }) => setAdding(paletteType(active.id))}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={resetDrag}
    >
      <div className="flex flex-col gap-5">
        <DesignPalette full={full} onAdd={handleAdd} />
        <DesignBlockList
          blocks={design.blocks}
          selected={selected}
          variables={variables}
          insertBefore={insertBefore}
          adding={adding !== null}
          full={full}
          onSelect={onSelect}
          onRemove={handleRemove}
          onDuplicate={handleDuplicate}
        />
      </div>
      <DragOverlay dropAnimation={null}>
        {adding ? (
          <div className="flex h-9 items-center gap-1.5 rounded-md border border-primary bg-card px-2 text-body shadow-md">
            <GripVertical aria-hidden="true" className="size-4 text-muted-foreground" />
            {copy.blocks[adding]}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
