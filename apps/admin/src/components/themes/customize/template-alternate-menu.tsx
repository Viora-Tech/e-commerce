'use client'

import { MoreHorizontal } from '@commerce/ui/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import { customizeContent } from '@/data/customize'
import { CHROME_FOCUS } from '@/lib/customize-chrome'

export type AlternateAction = 'rename' | 'duplicate' | 'delete'

type TemplateAlternateMenuProps = {
  /** The template's name as the picker shows it, for the trigger's accessible name. */
  name: string
  onAction: (action: AlternateAction) => void
}

const copy = customizeContent.templates

/** Keeps a press on the menu from also choosing the picker row it sits in. */
const stop = (event: PointerEvent | KeyboardEvent | MouseEvent) => event.stopPropagation()

/** The "⋯" on an alternate row of the template picker: rename, duplicate, delete. */
export default function TemplateAlternateMenu({ name, onAction }: TemplateAlternateMenuProps) {
  // Render logic
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={copy.manage(name)}
        onPointerDown={stop}
        onClick={stop}
        onKeyDown={stop}
        className={`ml-auto flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${CHROME_FOCUS}`}
      >
        <MoreHorizontal aria-hidden className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40" onPointerDown={stop} onClick={stop}>
        <DropdownMenuItem onClick={() => onAction('rename')}>{copy.rename}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction('duplicate')}>{copy.duplicate}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onAction('delete')}>
          {copy.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
