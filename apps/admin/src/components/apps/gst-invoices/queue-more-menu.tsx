'use client'

import { Plus } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import FormDialog from '@/components/layout/form-dialog'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { gstQueuePageContent } from '@/data/gst-queue-page'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'

type QueueMoreMenuProps = {
  /** Orders were added by number: reload the queue. */
  onAdded: () => void
  busy: boolean
}

/** Order numbers typed as "1042, 1043 1044". */
const parseNumbers = (text: string) =>
  [...new Set(text.split(/[\s,#]+/).map(Number))].filter((n) => Number.isInteger(n) && n > 0)

/**
 * The Queue's "…" menu: add orders by number. Dates are in the table's Filter menu, and the
 * ticked rows' actions (already invoiced, remove) in its bulk bar (23 Nov 2026).
 */
export default function QueueMoreMenu({ onAdded, busy }: QueueMoreMenuProps) {
  // Hooks
  const gstInvoicesCopy = useCopy(gstInvoicesContent)
  const copy = useCopy(gstQueuePageContent)
  const [dialog, setDialog] = useState<'add' | null>(null)
  const [numbers, setNumbers] = useState('')

  // Event handlers
  const handleAdd = async () => {
    const list = parseNumbers(numbers)
    if (!list.length) return
    try {
      const r = await api.gstInvoices.queue.add({ orderNumbers: list })
      toast.success(gstInvoicesCopy.queue.added(r?.added ?? 0))
      if (r?.missing.length) toast.error(gstInvoicesCopy.queue.notFound(r.missing.join(', ')))
      setNumbers('')
      setDialog(null)
      onAdded()
    } catch (err) {
      toast.error(errorText(err, gstInvoicesCopy.queue.failed))
    }
  }

  // Render logic
  return (
    <>
      <ActionMenu
        label={copy.more}
        variant="outline"
        size="md"
        disabled={busy}
        items={[{ label: copy.addByNumber, icon: Plus, onSelect: () => setDialog('add') }]}
      />
      <FormDialog
        open={dialog === 'add'}
        onOpenChange={(open) => setDialog(open ? 'add' : null)}
        title={copy.addTitle}
        description={copy.addBody}
        submitLabel={gstInvoicesCopy.queue.add}
        submitDisabled={parseNumbers(numbers).length === 0}
        onSubmit={handleAdd}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gst-queue-add">{copy.addField}</Label>
          <Input
            id="gst-queue-add"
            size="lg"
            autoFocus
            placeholder={gstInvoicesCopy.queue.addPlaceholder}
            value={numbers}
            onChange={(e) => setNumbers(e.target.value)}
          />
        </div>
      </FormDialog>
    </>
  )
}
