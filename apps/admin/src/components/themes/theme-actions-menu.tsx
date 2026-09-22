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

export type ThemeAction = 'rename' | 'duplicate' | 'download' | 'delete'

type ThemeActionsMenuProps = {
  actions: readonly ThemeAction[]
  disabled?: boolean
  onAction: (action: ThemeAction) => void
}

const copy = themesContent.library

const LABELS: Record<ThemeAction, string> = {
  rename: copy.rename,
  duplicate: copy.duplicate,
  download: copy.download,
  delete: copy.delete,
}

/** The kebab on a theme card: rename, duplicate, download settings, delete. */
export default function ThemeActionsMenu({ actions, disabled, onAction }: ThemeActionsMenuProps) {
  // Render logic
  const safe = actions.filter((a) => a !== 'delete')
  const canDelete = actions.includes('delete')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon" aria-label={copy.actions} disabled={disabled} />
        }
      >
        <MoreHorizontal aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {safe.map((a) => (
          <DropdownMenuItem key={a} onClick={() => onAction(a)}>
            {LABELS[a]}
          </DropdownMenuItem>
        ))}
        {canDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onAction('delete')}>
              {LABELS.delete}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
