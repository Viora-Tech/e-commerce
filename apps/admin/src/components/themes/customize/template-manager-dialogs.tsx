'use client'

import { TEMPLATE_SUFFIX } from '@commerce/core/theme'
import NameDialog from '@/components/fields/name-dialog'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import type { useTemplateManager } from '@/lib/use-template-manager'
import { usedLabel } from './template-list'

type TemplateManagerDialogsProps = {
  manager: ReturnType<typeof useTemplateManager>
}

/** A template manager's rename and delete dialogs, kept outside the picker's popover. */
export default function TemplateManagerDialogs({ manager }: TemplateManagerDialogsProps) {
  // Hooks
  const copy = useCopy(customizeContent.templates)

  // Early returns
  const pending = manager.pending
  if (pending?.action === 'rename') {
    const renameCopy = copy.renameDialog
    const used = usedLabel(manager, pending.kind, pending.suffix, copy)
    return (
      <NameDialog
        key={`${pending.kind}.${pending.suffix}`}
        title={renameCopy.title}
        label={renameCopy.name}
        submitLabel={renameCopy.confirm}
        cancelLabel={renameCopy.cancel}
        initialName={pending.suffix}
        maxLength={40}
        help={`${renameCopy.help}${used ? ` ${renameCopy.moves(used)}` : ''}`}
        normalise={(typed) => typed.trim().toLowerCase()}
        isValid={(name) => TEMPLATE_SUFFIX.test(name) && name !== pending.suffix}
        busy={manager.busy}
        onCancel={() => manager.setPending(null)}
        onSubmit={manager.rename}
      />
    )
  }
  if (pending?.action !== 'delete') return null

  // Render logic
  const deleteCopy = copy.deleteDialog
  const used = usedLabel(manager, pending.kind, pending.suffix, copy)
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
