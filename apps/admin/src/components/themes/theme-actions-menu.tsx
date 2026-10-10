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
import Link from 'next/link'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'

export type ThemeAction = 'rename' | 'duplicate' | 'download' | 'delete'

type ThemeActionsMenuProps = {
  actions: readonly ThemeAction[]
  /** Customize as the menu's first item (Figma "menu open"), for cards whose button is off-screen. */
  customizeHref?: string
  /** The live theme card's kebab is a key button beside Customize (Figma); rows keep the rim. */
  variant?: 'default' | 'outline'
  disabled?: boolean
  onAction: (action: ThemeAction) => void
}

/** The kebab on a theme card: customize, duplicate, rename, download settings, delete. */
export default function ThemeActionsMenu({
  actions,
  customizeHref,
  variant = 'outline',
  disabled,
  onAction,
}: ThemeActionsMenuProps) {
  // Hooks
  const labels = useCopy(themesContent.library)

  // Render logic
  const safe = actions.filter((a) => a !== 'delete')
  const canDelete = actions.includes('delete')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant={variant} size="icon" aria-label={labels.actions} disabled={disabled} />
        }
      >
        <MoreHorizontal aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {customizeHref ? (
          <DropdownMenuItem render={<Link href={customizeHref} />}>
            {labels.customize}
          </DropdownMenuItem>
        ) : null}
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
