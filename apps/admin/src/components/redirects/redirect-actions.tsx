'use client'

import { Pencil, Trash2 } from '@commerce/ui/icons'
import ActionMenu from '@/components/layout/action-menu'
import { redirectsContent } from '@/data/redirects'
import { useCopy } from '@/hooks/use-copy'

type RedirectActionsProps = {
  onEdit: () => void
  onDelete: () => void
}

/** The kebab on one redirect row: edit or delete. */
export default function RedirectActions({ onEdit, onDelete }: RedirectActionsProps) {
  // Hooks
  const { actions: copy } = useCopy(redirectsContent)

  return (
    <span className="flex items-center justify-end">
      <ActionMenu
        label={copy.label}
        trigger="kebab-vertical"
        items={[
          { label: copy.edit, icon: Pencil, onSelect: onEdit },
          { label: copy.delete, icon: Trash2, destructive: true, onSelect: onDelete },
        ]}
      />
    </span>
  )
}
