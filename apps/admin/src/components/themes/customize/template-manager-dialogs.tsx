'use client'

import ConfirmDialog from '@/components/layout/confirm-dialog'
import { customizeContent } from '@/data/customize'
import type { useTemplateManager } from '@/lib/use-template-manager'
import RenameTemplateDialog from './rename-template-dialog'
import { usedLabel } from './template-list'

type TemplateManagerDialogsProps = {
  manager: ReturnType<typeof useTemplateManager>
}

const copy = customizeContent.templates

/** A template manager's rename and delete dialogs, kept outside the picker's popover. */
export default function TemplateManagerDialogs({ manager }: TemplateManagerDialogsProps) {
  // Early returns
  const pending = manager.pending
  if (pending?.action === 'rename') {
    return (
      <RenameTemplateDialog
        key={`${pending.kind}.${pending.suffix}`}
        suffix={pending.suffix}
        used={usedLabel(manager, pending.kind, pending.suffix)}
        busy={manager.busy}
        onCancel={() => manager.setPending(null)}
        onRename={manager.rename}
      />
    )
  }
  if (pending?.action !== 'delete') return null

  // Render logic
  const deleteCopy = copy.deleteDialog
  const used = usedLabel(manager, pending.kind, pending.suffix)
  return (
    <ConfirmDialog
      tone="destructive"
      open
      onOpenChange={(open) => !open && manager.setPending(null)}
      title={deleteCopy.title(copy.alternate(copy.names[pending.kind], pending.suffix))}
      body={used ? `${deleteCopy.body} ${deleteCopy.fallback(used)}` : deleteCopy.body}
      confirmLabel={deleteCopy.confirm}
      cancelLabel={deleteCopy.cancel}
      onConfirm={() => void manager.remove()}
    />
  )
}
