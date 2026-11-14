'use client'

import { CONSENT_CHANNELS, type ConsentChannel } from '@commerce/core/privacy'
import { Download, Pencil, Save, Send, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import RunAutomationDialog from '@/components/automations/records/run-automation-dialog'
import { useRunAutomation } from '@/components/automations/records/use-run-automation'
import ActionMenu, { type ActionItem } from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { bulkActionsContent } from '@/data/bulk-actions'
import { CHANNEL_LABEL } from '@/data/customer-privacy'
import { customersContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { runBatched, toastOutcome } from '@/lib/run-batched'
import type { CustomerRow } from './customer-columns'
import SaveSelectionSegmentDialog from './save-selection-segment-dialog'

type CustomersBulkActionsProps = {
  ids: string[]
  /** The selected customers loaded on this page, for the Bcc email. */
  rows: CustomerRow[]
  /**
   * Consent channels the store can send on right now. The Marketing menu offers every channel
   * (consent can be recorded before SMS or WhatsApp is set up, #999) and marks the others.
   */
  sendable: readonly ConsentChannel[]
  onBulkEdit: () => void
  onTag: (action: 'add' | 'remove') => void
  onConsent: (channel: ConsentChannel, granted: boolean) => void
  onExport: () => void
  /** After the bulk delete: clear the selection and reload. */
  onDeleted: () => void
  /** The Automations app is installed: "Run automation" on the selection. */
  automations?: boolean
  /** After runs were queued: clear the selection. */
  onAutomationDone?: () => void
  /** After "Save as segment" tagged the selection: clear it and reload (#998). */
  onSegmentSaved: () => void
}

/** One mailto with the selected customers in Bcc, so the addresses stay private from each other. */
function bulkMailto(rows: CustomerRow[]): string | null {
  const emails = rows.flatMap((r) => (r.email ? [r.email] : []))
  return emails.length > 0 ? `mailto:?bcc=${encodeURIComponent(emails.join(','))}` : null
}

/**
 * The customer list's bulk actions: edit, tags, marketing and "Save as segment" as buttons;
 * export, email, run automation and delete in More actions.
 */
export default function CustomersBulkActions({
  ids,
  rows,
  sendable,
  onBulkEdit,
  onTag,
  onConsent,
  onExport,
  onDeleted,
  automations = false,
  onAutomationDone,
  onSegmentSaved,
}: CustomersBulkActionsProps) {
  // Hooks
  const { bulk: copy } = useCopy(customersContent)
  const shared = useCopy(bulkActionsContent)
  const automation = useRunAutomation('customer', automations)
  const [deleting, setDeleting] = useState(false)
  const [savingSegment, setSavingSegment] = useState(false)

  // Event handlers
  /* A customer with orders is kept (`deleted: false`), which counts as failed in the summary. */
  const handleDelete = async () => {
    const outcome = await runBatched(
      ids,
      (id) => api.customers.delete({ id }),
      (r) => r.deleted,
    )
    toastOutcome(outcome, shared.summary)
    onDeleted()
  }

  // Render logic
  const mail = bulkMailto(rows)
  const tagItems: ActionItem[] = [
    { label: copy.addTag, onSelect: () => onTag('add') },
    { label: copy.removeTag, onSelect: () => onTag('remove') },
  ]
  /* One group per channel; a channel the store cannot send on yet is headed with why. */
  const marketingItems: ActionItem[] = CONSENT_CHANNELS.flatMap((channel, i) => [
    {
      id: `${channel}:on`,
      label: copy.subscribe(CHANNEL_LABEL[channel]),
      onSelect: () => onConsent(channel, true),
      separatorBefore: i > 0,
      heading: sendable.includes(channel) ? undefined : copy.notSendable(CHANNEL_LABEL[channel]),
    },
    {
      id: `${channel}:off`,
      label: copy.unsubscribe(CHANNEL_LABEL[channel]),
      onSelect: () => onConsent(channel, false),
    },
  ])
  const moreItems: ActionItem[] = [
    { label: copy.export, icon: Download, onSelect: onExport },
    { label: copy.email, icon: Send, hidden: !mail, href: mail ?? undefined },
    ...automation.items(ids),
    { label: copy.delete, icon: Trash2, destructive: true, onSelect: () => setDeleting(true) },
  ]

  return (
    <>
      <Button variant="outline" size="sm" onClick={onBulkEdit}>
        <Pencil />
        {copy.bulkEdit}
      </Button>
      <ActionMenu
        label={copy.addTag}
        trigger="button"
        buttonSize="sm"
        align="start"
        items={tagItems}
      />
      <ActionMenu
        label={copy.marketing}
        trigger="button"
        buttonSize="sm"
        align="start"
        items={marketingItems}
      />
      <Button variant="outline" size="sm" onClick={() => setSavingSegment(true)}>
        <Save />
        {copy.saveSelection.action}
      </Button>
      <ActionMenu
        label={copy.more}
        trigger="button"
        align="start"
        items={moreItems}
        triggerClassName="h-8 rounded-sm px-3"
      />
      <RunAutomationDialog
        subjectType="customer"
        ids={automation.target}
        onClose={automation.close}
        onDone={onAutomationDone}
      />
      <SaveSelectionSegmentDialog
        ids={savingSegment ? ids : []}
        onClose={() => setSavingSegment(false)}
        onDone={onSegmentSaved}
      />
      <ConfirmDialog
        tone="destructive"
        open={deleting}
        onOpenChange={setDeleting}
        title={copy.deleteTitle(ids.length)}
        body={copy.deleteBody}
        confirmLabel={copy.deleteConfirm}
        cancelLabel={copy.cancel}
        onConfirm={handleDelete}
      />
    </>
  )
}
