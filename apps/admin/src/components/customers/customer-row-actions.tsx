'use client'

import { MessageSquare, Trash2 } from '@commerce/ui/icons'
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
import { type MouseEvent, useState } from 'react'
import { toast } from 'sonner'
import { customersContent } from '@/data/customers'
import { api } from '@/lib/api-client'

type CustomerRowActionsProps = {
  id: string
  name: string
  email: string | null
  onDeleted: () => void
}

/* Frame 5:3151: two 20px glyphs 8px apart, centred in the Action cell. */
const GLYPH =
  'inline-flex size-5 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-5 disabled:opacity-40 disabled:hover:text-muted-foreground'

const copy = customersContent.rowActions

/** Message and delete for one row; both stop the row's own navigation. */
export default function CustomerRowActions({
  id,
  name,
  email,
  onDeleted,
}: CustomerRowActionsProps) {
  // Hooks
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleMessage = (event: MouseEvent) => {
    event.stopPropagation()
    if (!email) {
      toast.error(copy.noEmail)
      return
    }
    window.location.href = `mailto:${email}`
  }

  const handleAskDelete = (event: MouseEvent) => {
    event.stopPropagation()
    setConfirming(true)
  }

  const handleDelete = async () => {
    setBusy(true)
    try {
      const result = await api.customers.delete({ id })
      if (!result.deleted) {
        toast.error(copy.deleteBlocked(result.orders))
        return
      }
      toast.success(copy.deleted)
      onDeleted()
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  // Render logic
  return (
    <span className="flex items-center justify-center gap-2">
      <button
        type="button"
        className={GLYPH}
        aria-label={copy.message(name)}
        title={email ?? copy.noEmail}
        disabled={!email}
        onClick={handleMessage}
      >
        <MessageSquare strokeWidth={1.6} />
      </button>
      <button
        type="button"
        className={GLYPH}
        aria-label={copy.delete(name)}
        title={copy.delete(name)}
        onClick={handleAskDelete}
      >
        <Trash2 strokeWidth={1.6} />
      </button>
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
