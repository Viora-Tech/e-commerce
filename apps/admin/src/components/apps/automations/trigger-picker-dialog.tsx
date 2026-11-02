'use client'

import type { CatalogueView, TriggerView } from '@commerce/core/automations'
import { Workflow } from '@commerce/ui/icons'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import DialogContent from '@/components/layout/dialog-content'
import DialogHeader from '@/components/layout/dialog-header'
import { automationPiecesContent, automationsContent } from '@/data/automations'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { triggerLabel } from '@/lib/automation-labels'
import { TRIGGER_GROUP_ICON } from '@/lib/automation-node-view'
import GroupedPicker, { type PickerGroup } from './grouped-picker'

type TriggerPickerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalogue: CatalogueView
  title: string
  description?: string | undefined
  onPick: (trigger: TriggerView) => void
}

const GROUP_ORDER: TriggerView['group'][] = [
  'orders',
  'customers',
  'products',
  'inventory',
  'marketing',
  'schedule',
  'manual',
]

/** Pick what starts a workflow: triggers grouped by resource, searchable. */
export default function TriggerPickerDialog({
  open,
  onOpenChange,
  catalogue,
  title,
  description,
  onPick,
}: TriggerPickerDialogProps) {
  // Hooks
  const { create, list } = useCopy(automationsContent)
  const pieces = useCopy(automationPiecesContent)
  const locale = useLocale()

  // Event handlers
  const handlePick = (id: string) => {
    const trigger = catalogue.triggers.find((t) => t.id === id)
    if (trigger) onPick(trigger)
  }

  // Render logic
  const groups: PickerGroup[] = GROUP_ORDER.map((g) => ({
    id: g,
    label: create.groups[g] ?? g,
    items: catalogue.triggers
      .filter((t) => t.group === g)
      .map((t) => ({
        id: t.id,
        label: triggerLabel(pieces, locale, t, t.id),
        icon: t.pluginId ? Workflow : TRIGGER_GROUP_ICON[g],
      })),
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {open ? (
          <GroupedPicker
            groups={groups}
            searchLabel={create.search}
            emptyLabel={list.noResults}
            onPick={handlePick}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
