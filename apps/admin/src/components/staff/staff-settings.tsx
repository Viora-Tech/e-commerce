'use client'

import { permissions } from '@commerce/core/permissions'
import { Plus, UserPlus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useQueryState } from 'nuqs'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageHeader from '@/components/layout/page-header'
import SettingsDrill from '@/components/settings/settings-drill'
import SettingsDrillPanel from '@/components/settings/settings-drill-panel'
import InviteDialog from '@/components/staff/invite-dialog'
import MembersCard, { type StaffMemberRow } from '@/components/staff/members-card'
import PendingInvitesCard, { type PendingInviteRow } from '@/components/staff/pending-invites-card'
import RolesCard, { type RoleRow } from '@/components/staff/roles-card'
import { settingsRowsContent } from '@/data/settings-rows'
import { staffContent } from '@/data/staff'
import { useCopy } from '@/hooks/use-copy'
import { refreshPermissions, usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

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

/**
 * Team and roles for this store, Shopify-style (#147): rows for members, pending invites and
 * roles, each opening in place (`?open=`). Server procedures re-check every action.
 */
export default function StaffSettings() {
  // Hooks
  const copy = useCopy(staffContent)
  const rowsCopy = useCopy(settingsRowsContent)
  const { member, hasPermission } = usePermissions()
  const [members, setMembers] = useState<StaffMemberRow[] | null>(null)
  const [roles, setRoles] = useState<RoleRow[] | null>(null)
  const [invites, setInvites] = useState<PendingInviteRow[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<StaffMemberRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<RoleRow | null>(null)
  const [open] = useQueryState('open')

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

  // Render logic
  const canManage = hasPermission(permissions.STAFF_MANAGE)
  const canInvite = hasPermission(permissions.STAFF_INVITE)
  const roleOptions = (roles ?? []).map((r) => ({ id: r.id, name: r.name, slug: r.slug }))
  const s = rowsCopy.staff
  const rows = [
    { id: 'members', title: s.members, value: members ? s.membersValue(members.length) : '' },
    { id: 'invites', title: s.invites, value: s.invitesValue(invites.length) },
    { id: 'roles', title: s.roles, value: roles ? s.rolesValue(roles.length) : '' },
  ]

  // Inside a row the header names it and leads back to Staff (one back link, as other settings
  // pages); its action sits in the header too: Create role on Roles, Invite member elsewhere.
  const openRow = rows.find((r) => r.id === open)
  const action =
    openRow?.id === 'roles' ? (
      canManage ? (
        <Button nativeButton={false} render={<Link href={routes.settings.newRole()} />}>
          <Plus aria-hidden="true" />
          {copy.roles.create}
        </Button>
      ) : undefined
    ) : canInvite ? (
      <Button onClick={() => setInviteOpen(true)}>
        <UserPlus aria-hidden="true" />
        {copy.members.invite}
      </Button>
    ) : undefined

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={openRow?.title ?? copy.title}
        subtitle={openRow ? undefined : copy.intro}
        back={openRow ? { label: copy.title, href: routes.settings.staff() } : undefined}
        actions={action}
      />
      <SettingsDrill rows={rows} backLabel={copy.title} backRow={false}>
        <SettingsDrillPanel id="members">
          <MembersCard
            members={members ?? []}
            roles={roleOptions}
            currentUserId={member?.userId ?? ''}
            canManage={canManage}
            onChanged={reload}
            onRemove={setPendingRemove}
          />
        </SettingsDrillPanel>
        <SettingsDrillPanel id="invites">
          <PendingInvitesCard invites={invites} canInvite={canInvite} onChanged={reload} />
        </SettingsDrillPanel>
        <SettingsDrillPanel id="roles">
          <RolesCard roles={roles ?? []} canManage={canManage} onDelete={setPendingDelete} />
        </SettingsDrillPanel>
      </SettingsDrill>

      <InviteDialog
        open={inviteOpen}
        roles={roleOptions}
        onOpenChange={setInviteOpen}
        onInvited={reload}
      />

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
        body={
          pendingDelete?.memberCount
            ? copy.roles.confirmDelete.hasMembers(pendingDelete.memberCount)
            : copy.roles.confirmDelete.body
        }
        confirmLabel={copy.roles.confirmDelete.confirm}
        cancelLabel={copy.roles.confirmDelete.cancel}
        confirmDisabled={Boolean(pendingDelete?.memberCount)}
        onConfirm={handleDeleteRole}
      />
    </div>
  )
}
