'use client'

import { MoreVertical, Pencil, Trash2 } from '@commerce/ui/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { useState } from 'react'
import { type MenuListItem, menusContent } from '@/data/menus'
import { useCopy } from '@/hooks/use-copy'
import DeleteMenuDialog from './delete-menu-dialog'
import RenameMenuDialog from './rename-menu-dialog'

type MenuActionsProps = { menu: MenuListItem }

/* Frame 5:3151: the 20px kebab, sitting at the end of the row's Action cell. */
const KEBAB =
  'flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

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
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={copy.label}
          className={KEBAB}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <MoreVertical className="size-5" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => setRenaming(true)}>
            <Pencil />
            {copy.rename}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setRemoving(true)}>
            <Trash2 />
            {copy.delete}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {renaming ? <RenameMenuDialog menu={menu} onClose={() => setRenaming(false)} /> : null}
      {removing ? <DeleteMenuDialog menu={menu} onClose={() => setRemoving(false)} /> : null}
    </span>
  )
}
