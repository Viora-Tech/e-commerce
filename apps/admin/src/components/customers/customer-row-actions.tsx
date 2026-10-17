'use client'

import { Send, Trash2, WhatsappLogo } from '@commerce/ui/icons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@commerce/ui/shadcn/alert-dialog'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import { customersContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { whatsappUrl } from '@/lib/customer-contact'

type CustomerRowActionsProps = {
  id: string
  name: string
  email: string | null
  phone: string | null
  onDeleted: () => void
}

/**
 * The ⋯ menu at the end of a customer row (next to the table's open arrow): email, WhatsApp
 * and delete. The row opens the customer on click, so every event here stops at the cell; the
 * menu and the confirm dialog are portalled out of the row.
 */
export default function CustomerRowActions({
  id,
  name,
  email,
  phone,
  onDeleted,
}: CustomerRowActionsProps) {
  // Hooks
  const content = useCopy(customersContent)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleDelete = async () => {
    setBusy(true)
    try {
      const result = await api.customers.delete({ id })
      if (!result.deleted) {
        toast.error(content.rowActions.deleteBlocked(result.orders))
        return
      }
      toast.success(content.rowActions.deleted)
      onDeleted()
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  // Render logic
  const copy = content.rowActions
  const chat = whatsappUrl(phone)

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: only stops the row's own click; the controls inside are buttons.
    // biome-ignore lint/a11y/useKeyWithClickEvents: same, keyboard events stop at the trigger.
    <span className="flex items-center" onClick={(event) => event.stopPropagation()}>
      <ActionMenu
        label={copy.menu(name)}
        items={[
          { label: copy.email, icon: Send, href: `mailto:${email}`, hidden: !email },
          {
            label: copy.whatsapp,
            icon: WhatsappLogo,
            href: chat ?? undefined,
            newTab: true,
            hidden: !chat,
          },
          {
            label: copy.delete(name),
            icon: Trash2,
            destructive: true,
            onSelect: () => setConfirming(true),
          },
        ]}
      />
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent onClick={(event) => event.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.deleteHeading}</AlertDialogTitle>
            <AlertDialogDescription>{copy.deleteBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onClick={handleDelete}>
              {copy.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  )
}
