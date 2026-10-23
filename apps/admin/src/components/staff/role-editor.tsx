'use client'

import { type Permission, permissions } from '@commerce/core/permissions'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SettingsCard from '@/components/settings/settings-card'
import PermissionSwitches from '@/components/staff/permission-switches'
import { staffContent } from '@/data/staff'
import { useCopy } from '@/hooks/use-copy'
import { refreshPermissions, usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

export type EditableRole = {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: Permission[]
}

type RoleEditorProps = {
  /** The role to edit; null creates one. */
  initial: EditableRole | null
}

/**
 * Settings → Staff → a role, on its own page: name, description and permissions.
 * Built in roles, and members without staff.manage, see it read only.
 */
export default function RoleEditor({ initial }: RoleEditorProps) {
  // Hooks
  const copy = useCopy(staffContent)
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [granted, setGranted] = useState<Permission[]>(initial?.permissions ?? [])
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      await api.staff.saveRole({
        id: initial?.id,
        name: name.trim(),
        description: description.trim() || null,
        permissions: granted,
      })
      refreshPermissions()
      toast.success(copy.roles.saved)
      router.push(routes.settings.staffRoles())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.errors.load)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const readOnly = initial?.isSystem === true || !hasPermission(permissions.STAFF_MANAGE)
  const changed =
    name !== (initial?.name ?? '') ||
    description !== (initial?.description ?? '') ||
    [...granted].sort().join() !== [...(initial?.permissions ?? [])].sort().join()
  const title = initial
    ? initial.isSystem
      ? initial.name
      : copy.roleForm.editTitle
    : copy.roleForm.createTitle

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={title}
        subtitle={initial?.isSystem ? copy.roleForm.readOnly : copy.members.intro}
        back={{ label: copy.roleForm.back, href: routes.settings.staffRoles() }}
        save={
          readOnly
            ? undefined
            : {
                dirty: changed && name.trim() !== '',
                saving,
                onSave: () => void handleSave(),
                label: copy.roleForm.save,
              }
        }
      />
      <SettingsCard bodyClassName="gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="role-name">{copy.roleForm.name}</Label>
          <Input
            id="role-name"
            value={name}
            disabled={readOnly}
            placeholder={copy.roleForm.namePlaceholder}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="role-description">{copy.roleForm.description}</Label>
          <Input
            id="role-description"
            value={description}
            disabled={readOnly}
            placeholder={copy.roleForm.descriptionPlaceholder}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </SettingsCard>
      <SettingsCard title={copy.roleForm.permissions}>
        <PermissionSwitches value={granted} disabled={readOnly} onChange={setGranted} />
      </SettingsCard>
    </div>
  )
}
