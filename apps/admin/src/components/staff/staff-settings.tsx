'use client'

import { permissions } from '@commerce/core/permissions'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@commerce/ui/shadcn/alert-dialog'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import SectionTabs from '@/components/settings/section-tabs'
import SettingsPageHeader from '@/components/settings/settings-page-header'
import SettingsSection from '@/components/settings/settings-section'
import InviteDialog from '@/components/staff/invite-dialog'
import MembersCard, { type StaffMemberRow } from '@/components/staff/members-card'
import PendingInvitesCard, { type PendingInviteRow } from '@/components/staff/pending-invites-card'
import RoleSheet from '@/components/staff/role-sheet'
import RolesCard, { type RoleRow } from '@/components/staff/roles-card'
import { staffContent as copy } from '@/data/staff'
import { refreshPermissions, usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'

const TABS = [copy.tabs.members, copy.tabs.roles]

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
  const { member, hasPermission } = usePermissions()
  const [members, setMembers] = useState<StaffMemberRow[] | null>(null)
  const [roles, setRoles] = useState<RoleRow[] | null>(null)
  const [invites, setInvites] = useState<PendingInviteRow[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editing, setEditing] = useState<RoleRow | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<StaffMemberRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<RoleRow | null>(null)

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
  const canManage = hasPermission(permissions.STAFF_MANAGE)
  const canInvite = hasPermission(permissions.STAFF_INVITE)
  const roleOptions = (roles ?? []).map((r) => ({ id: r.id, name: r.name, slug: r.slug }))

  return (
    <div className="flex flex-col gap-4">
      <SettingsPageHeader title={copy.title} subtitle={copy.intro} />
      <SectionTabs tabs={TABS}>
        <SettingsSection id={copy.tabs.members.id} className="flex flex-col gap-4">
          {canInvite ? (
            <div className="flex justify-end">
              <Button onClick={() => setInviteOpen(true)}>{copy.members.invite}</Button>
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
              <Button onClick={handleCreate}>{copy.roles.create}</Button>
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

      <AlertDialog open={pendingRemove !== null} onOpenChange={() => setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.members.confirmRemove.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {copy.members.confirmRemove.body(
                pendingRemove?.name ?? pendingRemove?.email ?? 'This person',
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.members.confirmRemove.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>
              {copy.members.confirmRemove.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingDelete !== null} onOpenChange={() => setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.roles.confirmDelete.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy.roles.confirmDelete.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.roles.confirmDelete.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRole}>
              {copy.roles.confirmDelete.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
