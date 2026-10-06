'use client'

import { MoreHorizontal } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
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
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { useState } from 'react'
import { toast } from 'sonner'
import RelativeTime from '@/components/layout/relative-time'
import { staffInvitesContent } from '@/data/staff-invites'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

export type PendingInviteRow = {
  id: string
  email: string
  roleId: string | null
  roleName: string | null
  invitedBy: string | null
  sentAt: string | Date
  expiresAt: string | Date
  expired: boolean
}

type PendingInvitesCardProps = {
  invites: PendingInviteRow[]
  canInvite: boolean
  onChanged: () => void
}

const ROW =
  'grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_7rem] items-center gap-3 px-4'

/** The admin's own accept page for an invitation, as the invite email links to it. */
function inviteLink(id: string): string {
  return `${window.location.origin}/accept-invitation/${id}`
}

/** Invitations sent from this store that nobody has accepted yet, with copy, resend and cancel. */
export default function PendingInvitesCard({
  invites,
  canInvite,
  onChanged,
}: PendingInvitesCardProps) {
  // Hooks
  const copy = useCopy(staffInvitesContent)
  const format = useFormat()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<PendingInviteRow | null>(null)

  // Event handlers
  const handleCopy = async (invite: PendingInviteRow) => {
    try {
      await navigator.clipboard.writeText(inviteLink(invite.id))
      toast.success(copy.copied)
    } catch {
      toast.error(copy.copyFailed)
    }
  }

  const handleResend = async (invite: PendingInviteRow) => {
    setBusyId(invite.id)
    try {
      const result = await api.staff.resendInvitation({ id: invite.id })
      if (result.emailSent) toast.success(copy.resent(invite.email))
      else toast.error(copy.emailFailed, { description: copy.emailFailedHelp })
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusyId(null)
    }
  }

  const handleCancel = async () => {
    const target = cancelling
    if (!target) return
    setCancelling(null)
    setBusyId(target.id)
    try {
      await api.staff.cancelInvitation({ id: target.id })
      toast.success(copy.cancelled)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card gap="none" inset="none">
      <div className="flex flex-col gap-1 px-4 pt-4 pb-3">
        <h2 className="text-card-title text-ink-strong">{copy.heading}</h2>
        <p className="text-body text-muted-foreground">{copy.intro}</p>
      </div>
      <div className={`${ROW} h-10 bg-muted/60 text-table-head text-muted-foreground`}>
        <span>{copy.columns.person}</span>
        <span>{copy.columns.role}</span>
        <span>{copy.columns.sent}</span>
        <span>{copy.columns.expires}</span>
        <span />
      </div>
      {invites.length === 0 ? (
        <p className="px-4 py-6 text-body text-muted-foreground">{copy.empty}</p>
      ) : (
        invites.map((invite) => {
          const busy = busyId === invite.id
          return (
            <div key={invite.id} className={`${ROW} min-h-14 border-border border-t py-2`}>
              <span className={cn('min-w-0', invite.expired && 'opacity-60')}>
                <span className="block truncate text-body-strong text-ink-strong">
                  {invite.email}
                </span>
                {invite.invitedBy ? (
                  <span className="block truncate text-caption text-muted-foreground">
                    {copy.invitedBy(invite.invitedBy)}
                  </span>
                ) : null}
              </span>
              <span className={cn('truncate text-body', invite.expired && 'opacity-60')}>
                {invite.roleName ?? copy.defaultRole}
              </span>
              <RelativeTime
                value={invite.sentAt}
                className={cn('text-body text-muted-foreground', invite.expired && 'opacity-60')}
              />
              {invite.expired ? (
                <Badge variant="neutral" className="w-fit">
                  {copy.expired}
                </Badge>
              ) : (
                <span className="text-body text-muted-foreground">
                  {format.date(invite.expiresAt)}
                </span>
              )}
              {canInvite ? (
                <div className="flex items-center justify-end gap-1">
                  {invite.expired ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => handleResend(invite)}
                    >
                      {copy.actions.resendShort}
                    </Button>
                  ) : null}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={busy}
                          aria-label={copy.actions.menu}
                        />
                      }
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {invite.expired ? null : (
                        <>
                          <DropdownMenuItem onClick={() => handleCopy(invite)}>
                            {copy.actions.copy}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleResend(invite)}>
                            {copy.actions.resend}
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem variant="destructive" onClick={() => setCancelling(invite)}>
                        {copy.actions.cancel}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <span />
              )}
            </div>
          )
        })
      )}

      <AlertDialog open={cancelling !== null} onOpenChange={() => setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.confirmCancel.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {copy.confirmCancel.body(cancelling?.email ?? '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.confirmCancel.keep}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>
              {copy.confirmCancel.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
