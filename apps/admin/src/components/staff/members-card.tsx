'use client'

import { MoreHorizontal } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
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
import MemberAvatar from '@/components/account/member-avatar'
import RelativeTime from '@/components/layout/relative-time'
import SettingsTable from '@/components/settings/settings-table'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import StatusLabel from '@/components/status/status-label'
import RowActionsCell from '@/components/table/row-actions-cell'
import { staffContent } from '@/data/staff'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

export type StaffMemberRow = {
  id: string
  userId: string
  name: string | null
  email: string | null
  image?: string | null
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

/** The team table: who is in the store, on what role, since when. */
export default function MembersCard({
  members,
  roles,
  currentUserId,
  canManage,
  onChanged,
  onRemove,
}: MembersCardProps) {
  // Hooks
  const copy = useCopy(staffContent)

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
    <SettingsTable
      actions
      total={members.length}
      columns={[
        { label: copy.members.columns.person },
        { label: copy.members.columns.role },
        { label: copy.members.columns.status, center: true },
        { label: copy.members.columns.added },
      ]}
    >
      {members.length === 0 ? (
        <SettingsTableRow>
          <SettingsTableCell className="text-muted-foreground">
            {copy.members.empty}
          </SettingsTableCell>
        </SettingsTableRow>
      ) : (
        members.map((m) => {
          const locked = m.isOwner || m.userId === currentUserId || !canManage
          return (
            <SettingsTableRow key={m.id}>
              <SettingsTableCell>
                <div className="flex min-w-0 items-center gap-3">
                  <MemberAvatar
                    name={m.name}
                    email={m.email}
                    image={m.image}
                    className="size-8 ring-1 ring-primary/20"
                    fallbackClassName="bg-primary-soft text-caption font-medium text-ink-strong"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-body font-semibold text-ink-strong">
                      {m.name ?? m.email ?? m.userId}
                      {m.userId === currentUserId ? (
                        <span className="ml-2 text-caption font-normal text-muted-foreground">
                          {copy.members.you}
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-caption text-muted-foreground">
                      {m.email}
                    </span>
                  </span>
                </div>
              </SettingsTableCell>
              <SettingsTableCell>
                {locked ? (
                  <span className="truncate">{m.roleName}</span>
                ) : (
                  <Select
                    items={roleItems}
                    value={m.roleId}
                    onValueChange={(v) => v && handleRole(m, v)}
                  >
                    <SelectTrigger className="h-8 w-full max-w-48">
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
              </SettingsTableCell>
              <SettingsTableCell center>
                <StatusLabel kind="member" value={m.status} />
              </SettingsTableCell>
              <SettingsTableCell>
                <RelativeTime value={m.createdAt} className="text-body text-muted-foreground" />
              </SettingsTableCell>
              <SettingsTableCell className="w-16 p-0 last:pr-2 md:last:pr-2">
                {locked ? null : (
                  <RowActionsCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon" aria-label={copy.members.remove} />
                        }
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem variant="destructive" onClick={() => onRemove(m)}>
                          {copy.members.remove}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </RowActionsCell>
                )}
              </SettingsTableCell>
            </SettingsTableRow>
          )
        })
      )}
    </SettingsTable>
  )
}
