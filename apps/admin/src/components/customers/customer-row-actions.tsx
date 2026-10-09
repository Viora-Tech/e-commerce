'use client'

import { MoreHorizontal, Send, Trash2, WhatsappLogo } from '@commerce/ui/icons'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { useState } from 'react'
import { toast } from 'sonner'
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

const KEBAB =
  'flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

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
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={copy.menu(name)}
          className={KEBAB}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-5" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {email ? (
            <DropdownMenuItem render={<a href={`mailto:${email}`} />}>
              <Send />
              {copy.email}
            </DropdownMenuItem>
          ) : null}
          {chat ? (
            <DropdownMenuItem render={<a href={chat} target="_blank" rel="noreferrer" />}>
              <WhatsappLogo />
              {copy.whatsapp}
            </DropdownMenuItem>
          ) : null}
          {email || chat ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
            <Trash2 />
            {copy.delete(name)}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
