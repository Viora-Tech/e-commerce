'use client'

import {
  canNeedApproval,
  DEFAULT_APPROVAL_PERMISSIONS,
  type Permission,
  permissions,
} from '@commerce/core/permissions'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { revalidateStaff } from '@/app/(admin)/settings/staff/actions'
import LeaveGuard from '@/components/layout/leave-guard'
import PageHeader from '@/components/layout/page-header'
import SettingsCard from '@/components/settings/settings-card'
import { countLevels, type EditRules, type RoleAccess } from '@/components/staff/role-access'
import RolePermissions from '@/components/staff/role-permissions'
import RoleSummaryBar from '@/components/staff/role-summary-bar'
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
  slug?: string
  /** "Ask first" ticks; absent while the role is new (it starts with the defaults). */
  needsApproval?: Permission[]
}

type RoleEditorProps = {
  /** The role to edit; null creates one. */
  initial: EditableRole | null
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  [...a].sort().join() === [...b].sort().join()

/** The ticks worth saving: Ask first only sits on a grant that changes something. */
const askedGrants = ({ granted, asks }: RoleAccess) =>
  asks.filter((p) => granted.includes(p) && canNeedApproval(p))

/** Drops every cached copy of the Staff pages; a failure here must not undo a saved role. */
const forgetCachedStaffPages = async () => {
  try {
    await revalidateStaff()
  } catch {
    // The role is saved; the router refresh below still reads it again.
  }
}

/**
 * Settings → Staff → a role, on its own page: name, description, then one table per area with an
 * Off / Allowed / Ask first radio per permission, and a bar at the bottom with the counts and the
 * one Save. Built-in roles keep their grants (the owner can still choose what asks first); only
 * the owner changes Ask first. After a save every cached copy of the Staff pages is dropped, so
 * the role never opens again as it was before (#1623).
 */
export default function RoleEditor({ initial }: RoleEditorProps) {
  // Hooks
  const copy = useCopy(staffContent)
  const router = useRouter()
  const { member, hasPermission } = usePermissions()
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [access, setAccess] = useState<RoleAccess>({
    granted: initial?.permissions ?? [],
    // A new role starts with the store's default ticks, as the server gives it.
    asks: initial ? (initial.needsApproval ?? []) : DEFAULT_APPROVAL_PERMISSIONS,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Event handlers
  /*
   * One Save for both: the role (name, description, grants) first, then the owner's Ask first
   * ticks on the saved role. A new role is created with the default ticks and then given the
   * owner's choice. Each endpoint keeps its own server-side checks.
   */
  const handleSave = async () => {
    setSaving(true)
    try {
      let roleId = initial?.id
      if (detailsChanged || grantsChanged || !roleId) {
        const result = await api.staff.saveRole({
          id: initial?.id,
          name: name.trim(),
          description: description.trim() || null,
          permissions: access.granted,
        })
        roleId = result.id
      }
      const asks = askedGrants(access)
      if (rules.askEditable && (!initial || !sameSet(asks, askedGrants(savedAccess)))) {
        await api.staff.saveRoleApprovals({ roleId, permissions: asks })
      }
      setSaved(true)
      refreshPermissions()
      await forgetCachedStaffPages()
      toast.success(copy.roles.saved)
      router.push(routes.settings.staffRoles())
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.errors.load)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const savedAccess: RoleAccess = {
    granted: initial?.permissions ?? [],
    asks: initial ? (initial.needsApproval ?? []) : DEFAULT_APPROVAL_PERMISSIONS,
  }
  const isOwnerRole = initial?.slug === 'owner'
  const rules: EditRules = {
    grantsLocked: initial?.isSystem === true || !hasPermission(permissions.STAFF_MANAGE),
    askEditable: member?.isOwner === true && !isOwnerRole,
    showAsk: !isOwnerRole,
  }
  const readOnly = rules.grantsLocked && !rules.askEditable
  const detailsChanged =
    name !== (initial?.name ?? '') || description !== (initial?.description ?? '')
  const grantsChanged = !sameSet(access.granted, savedAccess.granted)
  const asksChanged = !sameSet(askedGrants(access), askedGrants(savedAccess))
  const changed = detailsChanged || grantsChanged || asksChanged
  const title = initial
    ? initial.isSystem
      ? initial.name
      : copy.roleForm.editTitle
    : copy.roleForm.createTitle
  const subtitle = initial?.isSystem
    ? rules.askEditable
      ? copy.roleForm.builtInAskFirst
      : copy.roleForm.readOnly
    : copy.members.intro
  const help = isOwnerRole
    ? copy.roleForm.ownerNeverAsks
    : rules.askEditable
      ? copy.roleForm.askFirstHelp
      : `${copy.roleForm.askFirstHelp} ${copy.roleForm.askFirstOwnerOnly}`

  return (
    <div className="flex flex-col gap-4">
      <LeaveGuard when={changed && !saving && !saved} />
      <PageHeader
        title={title}
        subtitle={subtitle}
        back={{ label: copy.roleForm.back, href: routes.settings.staffRoles() }}
      />
      <SettingsCard bodyClassName="gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="role-name">{copy.roleForm.name}</Label>
          <Input
            id="role-name"
            value={name}
            disabled={rules.grantsLocked}
            placeholder={copy.roleForm.namePlaceholder}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="role-description">{copy.roleForm.description}</Label>
          <Input
            id="role-description"
            value={description}
            disabled={rules.grantsLocked}
            placeholder={copy.roleForm.descriptionPlaceholder}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </SettingsCard>
      <header className="flex flex-col gap-0.5 pt-2">
        <h2 className="text-[0.9375rem] leading-[1.375rem] font-semibold text-ink-strong">
          {copy.roleForm.permissions}
        </h2>
        <p className="text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">{help}</p>
      </header>
      <RolePermissions value={access} onChange={setAccess} rules={rules} />
      <RoleSummaryBar
        counts={countLevels(access, rules.showAsk)}
        showAsk={rules.showAsk}
        save={
          readOnly
            ? undefined
            : {
                dirty: changed && name.trim() !== '',
                saving,
                onSave: () => void handleSave(),
              }
        }
      />
    </div>
  )
}
