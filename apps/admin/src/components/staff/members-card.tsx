'use client'

import { MoreHorizontal } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { toast } from 'sonner'
import StatusLabel from '@/components/status/status-label'
import { staffContent as copy } from '@/data/staff'
import { api } from '@/lib/api-client'
import { formatDay } from '@/lib/format-date'

export type StaffMemberRow = {
  id: string
  userId: string
  name: string | null
  email: string | null
  roleId: string
  roleName: string
  roleSlug: string
  status: string
  isOwner: boolean
  createdAt: string | Date
}

export type RoleOption = { id: string; name: string; slug: string }

type MembersCardProps = {
  members: StaffMemberRow[]
  roles: RoleOption[]
  currentUserId: string
  canManage: boolean
  onChanged: () => void
  onRemove: (member: StaffMemberRow) => void
}

const ROW =
  'grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_2.5rem] items-center gap-3 px-4'

function initials(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.trim() || '?'
  return source.slice(0, 2).toUpperCase()
}

/** The team table: who is in the store, on what role, since when. */
export default function MembersCard({
  members,
  roles,
  currentUserId,
  canManage,
  onChanged,
  onRemove,
}: MembersCardProps) {
  // Event handlers
  const handleRole = async (member: StaffMemberRow, roleId: string) => {
    try {
      await api.staff.setMemberRole({ memberId: member.id, roleId })
      toast.success(copy.members.roleChanged)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.errors.load)
    }
  }

  // Render logic
  const assignable = roles.filter((r) => r.slug !== 'owner')
  const roleItems = Object.fromEntries(assignable.map((r) => [r.id, r.name]))

  return (
    <Card className="gap-0 p-0">
      <div className={`${ROW} h-10 rounded-t-lg bg-muted/60 text-table-head text-muted-foreground`}>
        <span>{copy.members.columns.person}</span>
        <span>{copy.members.columns.role}</span>
        <span>{copy.members.columns.status}</span>
        <span>{copy.members.columns.added}</span>
        <span />
      </div>
      {members.length === 0 ? (
        <p className="px-4 py-6 text-body text-muted-foreground">{copy.members.empty}</p>
      ) : (
        members.map((m) => {
          const locked = m.isOwner || m.userId === currentUserId || !canManage
          return (
            <div key={m.id} className={`${ROW} h-14 border-border border-t`}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-caption font-medium text-ink-strong ring-1 ring-primary/20">
                  {initials(m.name, m.email)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-body-strong text-ink-strong">
                    {m.name ?? m.email ?? m.userId}
                    {m.userId === currentUserId ? (
                      <span className="ml-2 text-caption text-muted-foreground">
                        {copy.members.you}
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-caption text-muted-foreground">
                    {m.email}
                  </span>
                </span>
              </div>
              {locked ? (
                <span className="truncate text-body">{m.roleName}</span>
              ) : (
                <Select
                  items={roleItems}
                  value={m.roleId}
                  onValueChange={(v) => v && handleRole(m, v)}
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignable.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <StatusLabel kind="member" value={m.status} />
              <span className="text-body text-muted-foreground">{formatDay(m.createdAt)}</span>
              {m.isOwner || m.userId === currentUserId || !canManage ? (
                <span />
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon" aria-label={copy.members.remove} />}
                  >
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem variant="destructive" onClick={() => onRemove(m)}>
                      {copy.members.remove}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )
        })
      )}
    </Card>
  )
}
