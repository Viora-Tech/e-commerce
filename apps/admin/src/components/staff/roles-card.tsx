'use client'

import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { staffContent as copy } from '@/data/staff'
import type { EditableRole } from './role-sheet'

export type RoleRow = EditableRole & { slug: string; memberCount: number }

type RolesCardProps = {
  roles: RoleRow[]
  canManage: boolean
  onEdit: (role: RoleRow) => void
  onDelete: (role: RoleRow) => void
}

/** The role list: what each role is for, who holds it, and how to change it. */
export default function RolesCard({ roles, canManage, onEdit, onDelete }: RolesCardProps) {
  // Render logic
  return (
    <Card className="gap-0 p-0">
      {roles.length === 0 ? (
        <p className="px-4 py-6 text-body text-muted-foreground">{copy.roles.empty}</p>
      ) : (
        roles.map((role, index) => (
          <div
            key={role.id}
            className={`flex items-center justify-between gap-4 px-4 py-3 ${
              index > 0 ? 'border-border border-t' : ''
            }`}
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-body-strong text-ink-strong">
                <span className="truncate">{role.name}</span>
                {role.isSystem ? <Badge variant="neutral">{copy.roles.builtIn}</Badge> : null}
              </p>
              <p className="truncate text-caption text-muted-foreground">
                {role.description ?? copy.roles.permissionCount(role.permissions.length)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-caption text-muted-foreground">
                {copy.roles.members(role.memberCount)}
              </span>
              <Button variant="outline" size="sm" onClick={() => onEdit(role)}>
                {role.isSystem ? 'View' : copy.roles.edit}
              </Button>
              {canManage && !role.isSystem ? (
                <Button variant="ghost" size="sm" onClick={() => onDelete(role)}>
                  {copy.roles.delete}
                </Button>
              ) : null}
            </div>
          </div>
        ))
      )}
    </Card>
  )
}
