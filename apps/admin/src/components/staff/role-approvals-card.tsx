'use client'

import {
  canNeedApproval,
  type Permission,
  RESOURCE_METADATA,
  type Resource,
} from '@commerce/core/permissions'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Label } from '@commerce/ui/shadcn/label'
import { useState } from 'react'
import { toast } from 'sonner'
import KitButton from '@/components/kit/kit-button'
import SettingsCard from '@/components/settings/settings-card'
import { approvalsContent } from '@/data/approvals'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type RoleApprovalsCardProps = {
  roleId: string
  /** The role's grants: only those that change something can need approval. */
  granted: Permission[]
  initial: Permission[]
  /** Only the owner changes ticks. */
  editable: boolean
}

/** `orders.refund` → "Orders: refund". */
function labelOf(permission: Permission): string {
  const [resource, action = ''] = permission.split('.') as [Resource, string]
  return `${RESOURCE_METADATA[resource]?.label ?? resource}: ${action.replaceAll('_', ' ')}`
}

/**
 * The role editor's "Needs approval" card: a tick per change the role may make. A ticked
 * change waits in Settings → Approvals for a different member instead of running.
 */
export default function RoleApprovalsCard({
  roleId,
  granted,
  initial,
  editable,
}: RoleApprovalsCardProps) {
  // Hooks
  const copy = useCopy(approvalsContent)
  const [ticked, setTicked] = useState<Permission[]>(initial)
  const [saved, setSaved] = useState<Permission[]>(initial)
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleToggle = (permission: Permission, on: boolean) =>
    setTicked((all) => (on ? [...all, permission] : all.filter((p) => p !== permission)))

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await api.staff.saveRoleApprovals({ roleId, permissions: ticked })
      setTicked(res.needsApproval)
      setSaved(res.needsApproval)
      toast.success(copy.role.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const options = granted.filter(canNeedApproval)
  const dirty = [...ticked].sort().join() !== [...saved].sort().join()

  return (
    <SettingsCard
      title={copy.role.heading}
      description={copy.role.help}
      footer={
        editable && options.length ? (
          <div className="flex justify-end">
            <KitButton variant="primary" onClick={handleSave} disabled={!dirty || saving}>
              {copy.role.save}
            </KitButton>
          </div>
        ) : undefined
      }
    >
      {options.length === 0 ? (
        <p className="text-body text-muted-foreground">{copy.role.empty}</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {options.map((permission) => (
            <div
              key={permission}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
            >
              <Checkbox
                id={`approval-${permission}`}
                checked={ticked.includes(permission)}
                disabled={!editable || saving}
                onCheckedChange={(on) => handleToggle(permission, on === true)}
              />
              <Label htmlFor={`approval-${permission}`} className="text-body font-normal">
                {labelOf(permission)}
              </Label>
            </div>
          ))}
        </div>
      )}
    </SettingsCard>
  )
}
