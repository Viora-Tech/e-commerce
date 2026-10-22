'use client'

import { permissions } from '@commerce/core/permissions'
import { Plus, UserPlus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageHeader from '@/components/layout/page-header'
import SectionTabs from '@/components/settings/section-tabs'
import SettingsSection from '@/components/settings/settings-section'
import InviteDialog from '@/components/staff/invite-dialog'
import MembersCard, { type StaffMemberRow } from '@/components/staff/members-card'
import PendingInvitesCard, { type PendingInviteRow } from '@/components/staff/pending-invites-card'
import RoleSheet from '@/components/staff/role-sheet'
import RolesCard, { type RoleRow } from '@/components/staff/roles-card'
import { SETTINGS_BACK } from '@/data/settings'
import { staffContent } from '@/data/staff'
import { useCopy } from '@/hooks/use-copy'
import { refreshPermissions, usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'

type Team = { members: StaffMemberRow[]; roles: RoleRow[]; invites: PendingInviteRow[] }

async function fetchTeam(): Promise<Team> {
  const [members, roles, invites] = await Promise.all([
    api.staff.members(),
    api.staff.roles(),
    api.staff.invitations(),
  ])
  return {
    members: members as StaffMemberRow[],
    roles: roles as RoleRow[],
    invites: invites as PendingInviteRow[],
  }
}

/** Team and roles for this store. Server procedures re-check every action. */
export default function StaffSettings() {
  // Hooks
  const copy = useCopy(staffContent)
  const { member, hasPermission } = usePermissions()
  const [members, setMembers] = useState<StaffMemberRow[] | null>(null)
  const [roles, setRoles] = useState<RoleRow[] | null>(null)
  const [invites, setInvites] = useState<PendingInviteRow[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editing, setEditing] = useState<RoleRow | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<StaffMemberRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<RoleRow | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: load the team once per mount
  useEffect(() => {
    let live = true
    fetchTeam()
      .then((team) => {
        if (!live) return
        setMembers(team.members)
        setRoles(team.roles)
        setInvites(team.invites)
      })
      .catch(() => {
        if (live) toast.error(copy.errors.load)
      })
    return () => {
      live = false
    }
  }, [])

  // Helpers
  const applyTeam = (team: Team) => {
    setMembers(team.members)
    setRoles(team.roles)
    setInvites(team.invites)
  }

  const reload = async () => {
    refreshPermissions()
    try {
      applyTeam(await fetchTeam())
    } catch {
      toast.error(copy.errors.load)
    }
  }

  // Event handlers
  const handleRemove = async () => {
    const target = pendingRemove
    if (!target) return
    setPendingRemove(null)
    try {
      await api.staff.removeMember({ memberId: target.id })
      toast.success(copy.members.removed)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.errors.load)
    }
  }

  const handleDeleteRole = async () => {
    const target = pendingDelete
    if (!target) return
    setPendingDelete(null)
    try {
      await api.staff.deleteRole({ id: target.id })
      toast.success(copy.roles.deleted)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.errors.load)
    }
  }

  const handleEdit = (role: RoleRow) => {
    setEditing(role)
    setSheetOpen(true)
  }

  const handleCreate = () => {
    setEditing(null)
    setSheetOpen(true)
  }

  // Render logic
  const tabs = [copy.tabs.members, copy.tabs.roles]
  const canManage = hasPermission(permissions.STAFF_MANAGE)
  const canInvite = hasPermission(permissions.STAFF_INVITE)
  const roleOptions = (roles ?? []).map((r) => ({ id: r.id, name: r.name, slug: r.slug }))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} subtitle={copy.intro} back={SETTINGS_BACK} />
      <SectionTabs tabs={tabs}>
        <SettingsSection id={copy.tabs.members.id} className="flex flex-col gap-4">
          {canInvite ? (
            <div className="flex justify-end">
              <Button onClick={() => setInviteOpen(true)}>
                <UserPlus aria-hidden="true" />
                {copy.members.invite}
              </Button>
            </div>
          ) : null}
          <MembersCard
            members={members ?? []}
            roles={roleOptions}
            currentUserId={member?.userId ?? ''}
            canManage={canManage}
            onChanged={reload}
            onRemove={setPendingRemove}
          />
          <PendingInvitesCard invites={invites} canInvite={canInvite} onChanged={reload} />
        </SettingsSection>
        <SettingsSection id={copy.tabs.roles.id} className="flex flex-col gap-4">
          {canManage ? (
            <div className="flex justify-end">
              <Button onClick={handleCreate}>
                <Plus aria-hidden="true" />
                {copy.roles.create}
              </Button>
            </div>
          ) : null}
          <RolesCard
            roles={roles ?? []}
            canManage={canManage}
            onEdit={handleEdit}
            onDelete={setPendingDelete}
          />
        </SettingsSection>
      </SectionTabs>

      <InviteDialog
        open={inviteOpen}
        roles={roleOptions}
        onOpenChange={setInviteOpen}
        onInvited={reload}
      />
      <RoleSheet open={sheetOpen} role={editing} onOpenChange={setSheetOpen} onSaved={reload} />

      <ConfirmDialog
        open={pendingRemove !== null}
        onOpenChange={() => setPendingRemove(null)}
        title={copy.members.confirmRemove.title}
        body={copy.members.confirmRemove.body(
          pendingRemove?.name ?? pendingRemove?.email ?? 'This person',
        )}
        confirmLabel={copy.members.confirmRemove.confirm}
        cancelLabel={copy.members.confirmRemove.cancel}
        tone="default"
        onConfirm={handleRemove}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={() => setPendingDelete(null)}
        title={copy.roles.confirmDelete.title}
        body={copy.roles.confirmDelete.body}
        confirmLabel={copy.roles.confirmDelete.confirm}
        cancelLabel={copy.roles.confirmDelete.cancel}
        tone="default"
        onConfirm={handleDeleteRole}
      />
    </div>
  )
}
