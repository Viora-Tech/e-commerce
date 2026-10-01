'use client'

import type { GstRegistrationView } from '@commerce/core'
import { MoreVertical } from '@commerce/ui/icons'
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
import { Badge } from '@commerce/ui/shadcn/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { businessGstContent } from '@/data/business-gst'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type RegistrationRowProps = {
  registration: GstRegistrationView
  /** The business's name, shown only when the store has more than one. */
  owner: string | null
  canManage: boolean
}

/** One GST number: state, GSTIN, badges, and Make default / Mark as cancelled. */
export default function RegistrationRow({
  registration: r,
  owner,
  canManage,
}: RegistrationRowProps) {
  // Hooks
  const { registrations: copy } = useCopy(businessGstContent)
  const router = useRouter()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [busy, setBusy] = useState(false)

  // Helpers
  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try {
      await action()
      toast.success(done)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handleMakeDefault = () =>
    run(() => api.businessGst.setDefault({ id: r.id }), copy.madeDefault)

  const handleCancel = async () => {
    setConfirmCancel(false)
    await run(() => api.businessGst.cancelRegistration({ id: r.id }), copy.didCancel)
  }

  // Render logic
  const actionable = canManage && r.active

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-body-strong text-ink-strong">
          {r.stateName}
          {r.isDefault ? <Badge variant="success">{copy.default}</Badge> : null}
          {r.registrationType === 'composition' ? (
            <Badge variant="neutral">{copy.composition}</Badge>
          ) : null}
          {r.active ? null : <Badge variant="neutral">{copy.cancelled}</Badge>}
        </span>
        <span className="font-mono text-body text-muted-foreground">{r.gstin}</span>
        {owner ? (
          <span className="text-caption text-muted-foreground">{copy.belongsTo(owner)}</span>
        ) : null}
      </div>
      {actionable ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={copy.actions}
            disabled={busy}
            className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MoreVertical className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {r.isDefault ? null : (
              <DropdownMenuItem onClick={handleMakeDefault}>{copy.makeDefault}</DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmCancel(true)}>
              {copy.cancel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.cancelTitle}</AlertDialogTitle>
            <AlertDialogDescription>{copy.cancelBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.keep}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleCancel}>
              {copy.confirmCancel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}
