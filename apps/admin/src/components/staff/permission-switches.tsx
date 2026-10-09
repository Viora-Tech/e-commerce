'use client'

import {
  type Permission,
  RESOURCE_METADATA,
  type Resource,
  statement,
} from '@commerce/core/permissions'
import { Button } from '@commerce/ui/shadcn/button'
import { Label } from '@commerce/ui/shadcn/label'
import { Switch } from '@commerce/ui/shadcn/switch'
import { staffContent } from '@/data/staff'
import { useCopy } from '@/hooks/use-copy'

type PermissionSwitchesProps = {
  value: Permission[]
  disabled?: boolean
  onChange: (next: Permission[]) => void
}

const RESOURCES = Object.keys(statement) as Resource[]

/** `orders.refund` reads as "Refund" beside its resource heading. */
function actionLabel(action: string): string {
  return action.charAt(0).toUpperCase() + action.slice(1)
}

function resourcePermissions(resource: Resource): Permission[] {
  return (statement[resource] as readonly string[]).map((a) => `${resource}.${a}` as Permission)
}

/** The grid of grants in the role editor, generated from the statement. */
export default function PermissionSwitches({ value, disabled, onChange }: PermissionSwitchesProps) {
  // Hooks
  const copy = useCopy(staffContent)

  // Helpers
  const setMany = (permissions: Permission[], on: boolean) => {
    const next = new Set(value)
    for (const p of permissions) {
      if (on) next.add(p)
      else next.delete(p)
    }
    onChange([...next])
  }

  // Event handlers
  const handleToggle = (permission: Permission, on: boolean) => setMany([permission], on)

  const handleToggleResource = (resource: Resource) => {
    const all = resourcePermissions(resource)
    setMany(all, !all.every((p) => value.includes(p)))
  }

  // Render logic
  const held = new Set(value)
  return (
    <div className="flex flex-col gap-6">
      {RESOURCES.map((resource) => {
        const all = resourcePermissions(resource)
        const meta = RESOURCE_METADATA[resource]
        const allOn = all.every((p) => held.has(p))
        return (
          <div key={resource} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-body-strong text-ink-strong">{meta.label}</p>
                <p className="text-caption text-muted-foreground">{meta.description}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => handleToggleResource(resource)}
              >
                {allOn ? copy.roleForm.clearAll : copy.roleForm.selectAll}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {all.map((permission) => {
                const action = permission.slice(resource.length + 1)
                return (
                  <div
                    key={permission}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
                  >
                    <Label htmlFor={permission} className="truncate text-body font-normal">
                      {actionLabel(action)}
                    </Label>
                    <Switch
                      id={permission}
                      checked={held.has(permission)}
                      disabled={disabled}
                      onCheckedChange={(on) => handleToggle(permission, on === true)}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
