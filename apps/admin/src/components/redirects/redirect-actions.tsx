'use client'

import { MoreVertical, Pencil, Trash2 } from '@commerce/ui/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { redirectsContent } from '@/data/redirects'

type RedirectActionsProps = {
  onEdit: () => void
  onDelete: () => void
}

const copy = redirectsContent.actions

const KEBAB =
  'flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** The kebab on one redirect row: edit or delete. */
export default function RedirectActions({ onEdit, onDelete }: RedirectActionsProps) {
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
          <DropdownMenuItem onClick={onEdit}>
            <Pencil />
            {copy.edit}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 />
            {copy.delete}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  )
}
