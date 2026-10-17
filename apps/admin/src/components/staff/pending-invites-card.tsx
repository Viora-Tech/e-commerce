'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
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
                      <ActionMenu
                        label={copy.actions.menu}
                        variant="ghost"
                        size="md"
                        disabled={busy}
                        items={[
                          {
                            label: copy.actions.copy,
                            hidden: invite.expired,
                            onSelect: () => handleCopy(invite),
                          },
                          {
                            label: copy.actions.resend,
                            hidden: invite.expired,
                            onSelect: () => handleResend(invite),
                          },
                          {
                            label: copy.actions.cancel,
                            destructive: true,
                            onSelect: () => setCancelling(invite),
                          },
                        ]}
                      />
                    </RowActionsCell>
                  ) : null}
                </SettingsTableCell>
              </SettingsTableRow>
            )
          })
        )}
      </SettingsTable>

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={() => setCancelling(null)}
        title={copy.confirmCancel.title}
        body={copy.confirmCancel.body(cancelling?.email ?? '')}
        confirmLabel={copy.confirmCancel.confirm}
        cancelLabel={copy.confirmCancel.keep}
        tone="default"
        onConfirm={handleCancel}
      />
    </>
  )
}
