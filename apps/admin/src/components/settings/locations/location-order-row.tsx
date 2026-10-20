'use client'

import { cn } from '@commerce/ui/lib/utils'
import { DragHandle, sortTransition } from '@commerce/ui/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'

type LocationOrderRowProps = {
  id: string
  handleLabel: string
  /** Members who can't manage settings see the order without a grip. */
  sortable: boolean
  /** True while the last move is saving. */
  disabled: boolean
  reduced: boolean
  children: ReactNode
}

/**
 * A location's row in the locations table, dragged by the grip in its first cell to change the
 * order checkout tries locations in.
 */
export default function LocationOrderRow({
  id,
  handleLabel,
  sortable,
  disabled,
  reduced,
  children,
}: LocationOrderRowProps) {
  // Hooks
  const drag = useSortable({
    id,
    disabled: !sortable || disabled,
    transition: sortTransition(reduced),
  })

  // Render logic
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = drag
  const style = { transform: CSS.Translate.toString(transform), transition }

  return (
    <SettingsTableRow
      ref={setNodeRef}
      style={style}
      className={cn('relative', drag.isDragging && 'z-10 bg-card shadow-popover')}
    >
      {sortable ? (
        <SettingsTableCell>
          <DragHandle
            ref={setActivatorNodeRef}
            label={handleLabel}
            disabled={disabled}
            {...attributes}
            {...listeners}
          />
        </SettingsTableCell>
      ) : null}
      {children}
    </SettingsTableRow>
  )
}
