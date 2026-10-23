'use client'

import { Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import SettingsTable from '@/components/settings/settings-table'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import RowActionsCell from '@/components/table/row-actions-cell'
import { staffContent } from '@/data/staff'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import type { EditableRole } from './role-editor'

export type RoleRow = EditableRole & { slug: string; memberCount: number }

type RolesCardProps = {
  roles: RoleRow[]
  canManage: boolean
  onDelete: (role: RoleRow) => void
}

/** The role list: what each role is for, who holds it, and how to change it. */
export default function RolesCard({ roles, canManage, onDelete }: RolesCardProps) {
  // Hooks
  const copy = useCopy(staffContent)

  return (
    <SettingsTable
      actions
      total={roles.length}
      columns={[
        { label: copy.roles.columns.role },
        { label: copy.roles.columns.members, center: true },
      ]}
    >
      {roles.length === 0 ? (
        <SettingsTableRow>
          <SettingsTableCell className="text-muted-foreground">
            {copy.roles.empty}
          </SettingsTableCell>
        </SettingsTableRow>
      ) : (
        roles.map((role) => (
          <SettingsTableRow key={role.id}>
            <SettingsTableCell>
              <p className="flex items-center gap-2 font-semibold text-ink-strong">
                <span className="truncate">{role.name}</span>
                {role.isSystem ? <StatusChip>{copy.roles.builtIn}</StatusChip> : null}
              </p>
              <p className="truncate text-caption text-muted-foreground">
                {role.description ?? copy.roles.permissionCount(role.permissions.length)}
              </p>
            </SettingsTableCell>
            <SettingsTableCell center className="text-muted-foreground">
              {copy.roles.members(role.memberCount)}
            </SettingsTableCell>
            <SettingsTableCell className="w-48 p-0 last:pr-2 md:last:pr-2">
              <RowActionsCell>
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={routes.settings.role(role.id)} />}
                >
                  {role.isSystem ? 'View' : copy.roles.edit}
                </Button>
                {canManage && !role.isSystem ? (
                  <Button variant="ghost" size="sm" onClick={() => onDelete(role)}>
                    <Trash2 aria-hidden="true" />
                    {copy.roles.delete}
                  </Button>
                ) : null}
              </RowActionsCell>
            </SettingsTableCell>
          </SettingsTableRow>
        ))
      )}
    </SettingsTable>
  )
}
