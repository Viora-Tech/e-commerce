'use client'

import { Pencil, Trash2 } from '@commerce/ui/icons'
import { useState } from 'react'
import ActionMenu from '@/components/layout/action-menu'
import { type MenuListItem, menusContent } from '@/data/menus'
import { useCopy } from '@/hooks/use-copy'
import DeleteMenuDialog from './delete-menu-dialog'
import RenameMenuDialog from './rename-menu-dialog'

type MenuActionsProps = { menu: MenuListItem }

/**
 * The kebab on one menu row. The cell sits inside a row that navigates on click,
 * so every event it owns stops at the cell; the menu popup is portalled out of
 * the row, and the dialogs render above the table.
 */
export default function MenuActions({ menu }: MenuActionsProps) {
  // Hooks
  const { actions: copy } = useCopy(menusContent)
  const [renaming, setRenaming] = useState(false)
  const [removing, setRemoving] = useState(false)

  // Render logic
  return (
    <span className="flex items-center justify-end">
      <ActionMenu
        label={copy.label}
        trigger="kebab-vertical"
        items={[
          { label: copy.rename, icon: Pencil, onSelect: () => setRenaming(true) },
          {
            label: copy.delete,
            icon: Trash2,
            destructive: true,
            onSelect: () => setRemoving(true),
          },
        ]}
      />
      {renaming ? <RenameMenuDialog menu={menu} onClose={() => setRenaming(false)} /> : null}
      {removing ? <DeleteMenuDialog menu={menu} onClose={() => setRemoving(false)} /> : null}
    </span>
  )
}
