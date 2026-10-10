'use client'

import { customizeContent } from '@/data/customize'
import type { useTemplateManager } from '@/lib/use-template-manager'
import DeleteTemplateDialog from './delete-template-dialog'
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
  return (
    <DeleteTemplateDialog
      name={copy.alternate(copy.names[pending.kind], pending.suffix)}
      used={usedLabel(manager, pending.kind, pending.suffix)}
      onCancel={() => manager.setPending(null)}
      onConfirm={manager.remove}
    />
  )
}
