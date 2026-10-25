'use client'

import { CONSENT_CHANNELS, type ConsentChannel } from '@commerce/core/privacy'
import { ChevronDown, Download, Pencil, Send, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { Fragment, useState } from 'react'
import RunAutomationButton from '@/components/automations/records/run-automation-button'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { bulkActionsContent } from '@/data/bulk-actions'
import { CHANNEL_LABEL } from '@/data/customer-privacy'
import { customersContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { runBatched, toastOutcome } from '@/lib/run-batched'
import type { CustomerRow } from './customer-columns'

type CustomersBulkActionsProps = {
  ids: string[]
  /** The selected customers loaded on this page, for the Bcc email. */
  rows: CustomerRow[]
  /** Consent channels the store can send on right now. */
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
}

/** One mailto with the selected customers in Bcc, so the addresses stay private from each other. */
function bulkMailto(rows: CustomerRow[]): string | null {
  const emails = rows.flatMap((r) => (r.email ? [r.email] : []))
  return emails.length > 0 ? `mailto:?bcc=${encodeURIComponent(emails.join(','))}` : null
}

/** The customer list's selection bar: edit, tag, consent, export, email and delete. */
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
}: CustomersBulkActionsProps) {
  // Hooks
  const { bulk: copy } = useCopy(customersContent)
  const shared = useCopy(bulkActionsContent)
  const [deleting, setDeleting] = useState(false)

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

  return (
    <>
      <Button variant="outline" size="sm" onClick={onBulkEdit}>
        <Pencil />
        {copy.bulkEdit}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          {copy.addTag}
          <ChevronDown />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onTag('add')}>{copy.addTag}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onTag('remove')}>{copy.removeTag}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          {copy.marketing}
          <ChevronDown />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {CONSENT_CHANNELS.filter((c) => sendable.includes(c)).map((channel, i) => (
            <Fragment key={channel}>
              {i > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem onClick={() => onConsent(channel, true)}>
                {copy.subscribe(CHANNEL_LABEL[channel])}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onConsent(channel, false)}>
                {copy.unsubscribe(CHANNEL_LABEL[channel])}
              </DropdownMenuItem>
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="outline" size="sm" onClick={onExport}>
        <Download aria-hidden="true" />
        {copy.export}
      </Button>
      {mail ? (
        <Button variant="outline" size="sm" render={<a href={mail} />} nativeButton={false}>
          <Send aria-hidden="true" />
          {copy.email}
        </Button>
      ) : null}
      <RunAutomationButton
        subjectType="customer"
        ids={ids}
        installed={automations}
        onDone={onAutomationDone}
      />
      <Button variant="outline" size="sm" onClick={() => setDeleting(true)}>
        <Trash2 aria-hidden="true" />
        {copy.delete}
      </Button>
      <ConfirmDialog
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
