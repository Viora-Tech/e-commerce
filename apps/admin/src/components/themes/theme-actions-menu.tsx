'use client'

import { MoreHorizontal } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'

export type ThemeAction = 'rename' | 'duplicate' | 'download' | 'delete'

type ThemeActionsMenuProps = {
  actions: readonly ThemeAction[]
  disabled?: boolean
  onAction: (action: ThemeAction) => void
}

/** The kebab on a theme card: rename, duplicate, download settings, delete. */
export default function ThemeActionsMenu({ actions, disabled, onAction }: ThemeActionsMenuProps) {
  // Hooks
  const labels = useCopy(themesContent.library)

  // Render logic
  const safe = actions.filter((a) => a !== 'delete')
  const canDelete = actions.includes('delete')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon" aria-label={labels.actions} disabled={disabled} />
        }
      >
        <MoreHorizontal aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {safe.map((a) => (
          <DropdownMenuItem key={a} onClick={() => onAction(a)}>
            {labels[a]}
          </DropdownMenuItem>
        ))}
        {canDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onAction('delete')}>
              {labels.delete}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
