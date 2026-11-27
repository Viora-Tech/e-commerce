'use client'

import { Plus } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { useState } from 'react'
import { toast } from 'sonner'
import { useAppShell } from '@/components/apps/app-shell-context'
import AppUninstallButton from '@/components/apps/app-uninstall-button'
import ActionMenu, { type ActionItem } from '@/components/layout/action-menu'
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
 * The Queue's one "…" menu (More actions): add orders by number, then the app's Settings and
 * Uninstall, which the shell's own menu held before the two were merged (owner, 28 Nov 2026:
 * two "…" menus side by side). Dates are in the table's Filter menu, and the ticked rows' actions
 * (issue, already invoiced, remove) in its bulk bar.
 */
export default function QueueMoreMenu({ onAdded, busy }: QueueMoreMenuProps) {
  // Hooks
  const gstInvoicesCopy = useCopy(gstInvoicesContent)
  const copy = useCopy(gstQueuePageContent)
  const app = useAppShell()
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
  const items: ActionItem[] = [
    { label: copy.addByNumber, icon: Plus, onSelect: () => setDialog('add') },
  ]

  return (
    <>
      {app ? (
        <AppUninstallButton
          appId={app.appId}
          name={app.name}
          settingsHref={app.settingsHref}
          items={items}
          label={copy.more}
          variant="outline"
          disabled={busy}
        />
      ) : (
        <ActionMenu label={copy.more} variant="outline" size="md" disabled={busy} items={items} />
      )}
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
