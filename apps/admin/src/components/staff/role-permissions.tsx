'use client'

import { type Resource, statement } from '@commerce/core/permissions'
import type { EditRules, RoleAccess } from './role-access'
import RoleAreaTable from './role-area-table'

type RolePermissionsProps = {
  value: RoleAccess
  onChange: (next: RoleAccess) => void
  rules: EditRules
}

const RESOURCES = Object.keys(statement) as Resource[]

/**
 * The role page's permissions: one table per area (Orders, Draft orders, Products, …), each row
 * Off / Allowed / Ask first (rules in `role-access.ts`). Ask first is a grant that waits in
 * Approvals; reads (and approving itself) never ask.
 */
export default function RolePermissions({ value, onChange, rules }: RolePermissionsProps) {
  return (
    <div className="flex flex-col gap-4">
      {RESOURCES.map((resource) => (
        <RoleAreaTable
          key={resource}
          resource={resource}
          value={value}
          onChange={onChange}
          rules={rules}
        />
      ))}
    </div>
  )
}
