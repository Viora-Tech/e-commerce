'use client'

import { CalendarIcon, Plus, Trash2 } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { useState } from 'react'
import { toast } from 'sonner'
import DateField from '@/components/fields/date-field'
import ActionMenu from '@/components/layout/action-menu'
import FormDialog from '@/components/layout/form-dialog'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { gstQueuePageContent } from '@/data/gst-queue-page'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

export type DateRange = { from: string; to: string }

type QueueMoreMenuProps = {
  range: DateRange
  onRange: (range: DateRange) => void
  /** How many rows are ticked; Remove works on them. */
  pickedCount: number
  onRemove: () => void
  /** Orders were added by number: reload the queue. */
  onAdded: () => void
  busy: boolean
}

/** Order numbers typed as "1042, 1043 1044". */
const parseNumbers = (text: string) =>
  [...new Set(text.split(/[\s,#]+/).map(Number))].filter((n) => Number.isInteger(n) && n > 0)

/**
 * The Queue's "…" menu: what the old page showed inline and the frame leaves out. Add orders
 * by number, filter by the day they became due, and take ticked rows out of the queue.
 */
export default function QueueMoreMenu({
  range,
  onRange,
  pickedCount,
  onRemove,
  onAdded,
  busy,
}: QueueMoreMenuProps) {
  // Hooks
  const copy = useCopy(gstQueuePageContent)
  const [dialog, setDialog] = useState<'add' | 'dates' | null>(null)
  const [numbers, setNumbers] = useState('')
  const [draft, setDraft] = useState<DateRange>(range)

  // Event handlers
  const handleAdd = async () => {
    const list = parseNumbers(numbers)
    if (!list.length) return
    try {
      const r = await api.gstInvoices.queue.add({ orderNumbers: list })
      toast.success(gstInvoicesContent.queue.added(r?.added ?? 0))
      if (r?.missing.length) toast.error(gstInvoicesContent.queue.notFound(r.missing.join(', ')))
      setNumbers('')
      setDialog(null)
      onAdded()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : gstInvoicesContent.queue.failed)
    }
  }
  const handleDates = () => {
    onRange(draft)
    setDialog(null)
  }
  const handleOpenDates = () => {
    setDraft(range)
    setDialog('dates')
  }

  // Render logic
  const filtered = Boolean(range.from || range.to)

  return (
    <>
      <ActionMenu
        label={copy.more}
        variant="outline"
        size="md"
        disabled={busy}
        items={[
          { label: copy.addByNumber, icon: Plus, onSelect: () => setDialog('add') },
          { label: copy.filterDates, icon: CalendarIcon, onSelect: handleOpenDates },
          {
            label: copy.clearDates,
            onSelect: () => onRange({ from: '', to: '' }),
            hidden: !filtered,
          },
          {
            label: copy.removeSelected,
            icon: Trash2,
            onSelect: onRemove,
            hidden: pickedCount === 0,
            destructive: true,
          },
        ]}
      />
      <FormDialog
        open={dialog === 'add'}
        onOpenChange={(open) => setDialog(open ? 'add' : null)}
        title={copy.addTitle}
        description={copy.addBody}
        submitLabel={gstInvoicesContent.queue.add}
        submitDisabled={parseNumbers(numbers).length === 0}
        onSubmit={handleAdd}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gst-queue-add">{copy.addField}</Label>
          <Input
            id="gst-queue-add"
            size="lg"
            autoFocus
            placeholder={gstInvoicesContent.queue.addPlaceholder}
            value={numbers}
            onChange={(e) => setNumbers(e.target.value)}
          />
        </div>
      </FormDialog>
      <FormDialog
        open={dialog === 'dates'}
        onOpenChange={(open) => setDialog(open ? 'dates' : null)}
        title={copy.datesTitle}
        submitLabel={copy.apply}
        onSubmit={handleDates}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{gstInvoicesContent.queue.from}</Label>
            <DateField
              value={draft.from}
              clearable
              onChange={(v) => setDraft((d) => ({ ...d, from: v }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{gstInvoicesContent.queue.to}</Label>
            <DateField
              value={draft.to}
              clearable
              onChange={(v) => setDraft((d) => ({ ...d, to: v }))}
            />
          </div>
        </div>
      </FormDialog>
    </>
  )
}
