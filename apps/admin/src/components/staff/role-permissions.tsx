'use client'

import {
  canNeedApproval,
  type Permission,
  RESOURCE_METADATA,
  type Resource,
  statement,
} from '@commerce/core/permissions'
import { Button } from '@commerce/ui/shadcn/button'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import {
  type Level,
  levelOf,
  type RoleAccess,
  resourcePermissions,
  setLevel,
  toggleResource,
} from '@/components/staff/role-access'
import { staffContent } from '@/data/staff'
import { useCopy } from '@/hooks/use-copy'

type RolePermissionsProps = {
  value: RoleAccess
  onChange: (next: RoleAccess) => void
  /** Grants are fixed: a built-in role, or a member without staff.manage. */
  grantsLocked: boolean
  /** Ask first can be changed: only the owner, and never on the owner role. */
  askEditable: boolean
  /** The owner role never asks, so its rows have no Ask first. */
  showAsk: boolean
}

const RESOURCES = Object.keys(statement) as Resource[]

/** `orders.refund` reads as "Refund" beside its resource heading; `manage_types` as "Manage types". */
function actionLabel(action: string): string {
  const words = action.replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * The role editor's Permissions card body: one Off / Allowed / Ask first control per permission
 * (rules in `role-access.ts`). Ask first is a grant that waits in Approvals; reads (and
 * approving itself) can never ask, so their rows have only Off and Allowed.
 */
export default function RolePermissions({
  value,
  onChange,
  grantsLocked,
  askEditable,
  showAsk,
}: RolePermissionsProps) {
  // Hooks
  const copy = useCopy(staffContent)

  // Event handlers
  const handleLevel = (permission: Permission, picked: string[]) => {
    const level = picked[0] as Level | undefined
    if (!level || level === levelOf(value, permission, showAsk)) return
    onChange(setLevel(value, permission, level, askEditable))
  }

  const handleToggleResource = (resource: Resource) =>
    onChange(toggleResource(value, resource, askEditable))

  // Render logic
  return (
    <div className="flex flex-col gap-6">
      {RESOURCES.map((resource) => {
        const all = resourcePermissions(resource)
        const meta = RESOURCE_METADATA[resource]
        const allOn = all.every((p) => value.granted.includes(p))
        return (
          <section key={resource} className="flex flex-col gap-3" aria-label={meta.label}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-body-strong text-ink-strong">{meta.label}</p>
                <p className="text-caption text-muted-foreground">{meta.description}</p>
              </div>
              {grantsLocked ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleResource(resource)}
                >
                  {allOn ? copy.roleForm.clearAll : copy.roleForm.selectAll}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {all.map((permission) => {
                const action = actionLabel(permission.slice(resource.length + 1))
                const level = levelOf(value, permission, showAsk)
                const askable = showAsk && canNeedApproval(permission)
                const locked = grantsLocked && level === 'off'
                return (
                  <div
                    key={permission}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
                  >
                    <span className="min-w-0 truncate text-body">{action}</span>
                    <ToggleGroup
                      aria-label={`${meta.label}: ${action}`}
                      value={[level]}
                      onValueChange={(picked) => handleLevel(permission, picked)}
                      variant="outline"
                      size="sm"
                      spacing={0}
                    >
                      <ToggleGroupItem value="off" disabled={grantsLocked}>
                        {copy.roleForm.off}
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="allowed"
                        disabled={locked || (level === 'ask' && !askEditable)}
                        className="aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                      >
                        {copy.roleForm.allowed}
                      </ToggleGroupItem>
                      {askable ? (
                        <ToggleGroupItem
                          value="ask"
                          disabled={locked || !askEditable}
                          className="aria-pressed:border-warning-border aria-pressed:bg-warning-soft aria-pressed:text-warning-foreground dark:aria-pressed:border-warning dark:aria-pressed:bg-warning"
                        >
                          {copy.roleForm.askFirst}
                        </ToggleGroupItem>
                      ) : null}
                    </ToggleGroup>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
