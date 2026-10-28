'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { ORPCError } from '@orpc/client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
import { staffContent } from '@/data/staff'
import { staffInvitesContent } from '@/data/staff-invites'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

export type InvitableRole = { id: string; name: string; slug: string }

type InviteDialogProps = {
  open: boolean
  roles: InvitableRole[]
  onOpenChange: (open: boolean) => void
  onInvited: () => void
}

/** The plan's staff accounts when the invite was refused for being over them. */
const staffLimit = (err: unknown): { limit: number } | null =>
  err instanceof ORPCError && err.data?.reason === 'staff_limit'
    ? { limit: Number(err.data.limit) }
    : null

/** Sends a Better Auth invitation and records the role the person will hold. */
export default function InviteDialog({ open, roles, onOpenChange, onInvited }: InviteDialogProps) {
  // Hooks
  const copy = useCopy(staffContent)
  const invitesCopy = useCopy(staffInvitesContent)
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setEmail('')
    setRoleId(roles.find((r) => r.slug === 'staff')?.id ?? roles[0]?.id ?? '')
  }, [open, roles])

  // Event handlers
  const handleSend = async () => {
    setSending(true)
    try {
      const result = await api.staff.invite({ email: email.trim(), roleId })
      // The invitation exists either way; when its email did not go it waits under Pending invites.
      if (result.emailSent) toast.success(copy.invite.sent(email.trim()))
      else toast.error(invitesCopy.emailFailed, { description: invitesCopy.emailFailedHelp })
      onOpenChange(false)
      onInvited()
    } catch (err) {
      const seats = staffLimit(err)
      if (seats) toast.error(copy.invite.limit(seats.limit), { description: copy.invite.limitHelp })
      else toast.error(err instanceof Error ? err.message : copy.invite.failed)
    } finally {
      setSending(false)
    }
  }

  // Render logic
  const invitable = roles.filter((r) => r.slug !== 'owner')
  const roleItems = Object.fromEntries(invitable.map((r) => [r.id, r.name]))

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.invite.title}
      description={copy.invite.body}
      submitLabel={copy.invite.send}
      cancelLabel={copy.invite.cancel}
      busy={sending}
      submitDisabled={!email.trim() || !roleId}
      onSubmit={handleSend}
      size="md"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-email">{copy.invite.email}</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            placeholder={copy.invite.emailPlaceholder}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-role">{copy.invite.role}</Label>
          <Select items={roleItems} value={roleId} onValueChange={(v) => v && setRoleId(v)}>
            <SelectTrigger id="invite-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {invitable.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </FormDialog>
  )
}
