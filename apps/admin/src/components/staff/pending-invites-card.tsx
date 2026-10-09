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
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { useState } from 'react'
import { toast } from 'sonner'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import SettingsTable from '@/components/settings/settings-table'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import RowActionsCell from '@/components/table/row-actions-cell'
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
    <>
      <SettingsTable
        heading={copy.heading}
        description={copy.intro}
        actions
        total={invites.length}
        columns={[
          { label: copy.columns.person },
          { label: copy.columns.role },
          { label: copy.columns.sent },
          { label: copy.columns.expires },
        ]}
      >
        {invites.length === 0 ? (
          <SettingsTableRow>
            <SettingsTableCell className="text-muted-foreground">{copy.empty}</SettingsTableCell>
          </SettingsTableRow>
        ) : (
          invites.map((invite) => {
            const busy = busyId === invite.id
            return (
              <SettingsTableRow key={invite.id}>
                <SettingsTableCell className={cn(invite.expired && 'opacity-60')}>
                  <span className="block truncate font-semibold text-ink-strong">
                    {invite.email}
                  </span>
                  {invite.invitedBy ? (
                    <span className="block truncate text-caption text-muted-foreground">
                      {copy.invitedBy(invite.invitedBy)}
                    </span>
                  ) : null}
                </SettingsTableCell>
                <SettingsTableCell className={cn(invite.expired && 'opacity-60')}>
                  {invite.roleName ?? copy.defaultRole}
                </SettingsTableCell>
                <SettingsTableCell className={cn(invite.expired && 'opacity-60')}>
                  <RelativeTime value={invite.sentAt} className="text-body text-muted-foreground" />
                </SettingsTableCell>
                <SettingsTableCell className="text-muted-foreground">
                  {invite.expired ? (
                    <StatusChip>{copy.expired}</StatusChip>
                  ) : (
                    format.date(invite.expiresAt)
                  )}
                </SettingsTableCell>
                <SettingsTableCell className="w-16 p-0 last:pr-2 md:last:pr-2">
                  {canInvite ? (
                    <RowActionsCell>
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
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setCancelling(invite)}
                          >
                            {copy.actions.cancel}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </RowActionsCell>
                  ) : null}
                </SettingsTableCell>
              </SettingsTableRow>
            )
          })
        )}
      </SettingsTable>

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
    </>
  )
}
