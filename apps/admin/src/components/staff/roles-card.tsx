'use client'

import { ChevronRight, ShieldCheck, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import MemberAvatar from '@/components/account/member-avatar'
import SettingsTable from '@/components/settings/settings-table'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import { staffContent } from '@/data/staff'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import type { StaffMemberRow } from './members-card'
import { countLevels } from './role-access'
import type { EditableRole } from './role-editor'
import RoleLevelSummary from './role-level-summary'

export type RoleRow = EditableRole & { slug: string; memberCount: number }

type RolesCardProps = {
  roles: RoleRow[]
  /** The same member list the Members row shows: each role's faces and count come from it. */
  members: StaffMemberRow[]
  canManage: boolean
  /** The owner can change Ask first on every role but their own. */
  isOwner: boolean
  onDelete: (role: RoleRow) => void
}

const FACES = 3

/**
 * The role list: what each role may do (allowed / ask first / off), who holds it, and a clear way
 * in. The whole row opens the role; role pages are never prefetched, so a role always opens as it
 * is saved now (#1623).
 */
export default function RolesCard({
  roles,
  members,
  canManage,
  isOwner,
  onDelete,
}: RolesCardProps) {
  // Hooks
  const copy = useCopy(staffContent)

  return (
    <SettingsTable
      actions
      total={roles.length}
      columns={[
        { label: copy.roles.columns.role },
        { label: copy.roles.columns.access, className: 'hidden lg:table-cell' },
        { label: copy.roles.columns.members, className: 'hidden sm:table-cell' },
      ]}
    >
      {roles.length === 0 ? (
        <SettingsTableRow>
          <SettingsTableCell className="text-muted-foreground">
            {copy.roles.empty}
          </SettingsTableCell>
        </SettingsTableRow>
      ) : (
        roles.map((role) => {
          const href = routes.settings.role(role.id)
          const showAsk = role.slug !== 'owner'
          const counts = countLevels(
            { granted: role.permissions, asks: role.needsApproval ?? [] },
            showAsk,
          )
          const holders = members.filter((m) => m.roleId === role.id)
          const canEdit = (canManage && !role.isSystem) || (isOwner && showAsk)
          return (
            <SettingsTableRow key={role.id} href={href}>
              <SettingsTableCell className="py-3">
                <p className="flex items-baseline gap-2">
                  <Link
                    href={href}
                    prefetch={false}
                    className="truncate font-semibold text-ink-strong hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {role.name}
                  </Link>
                  {role.isSystem ? (
                    <span className="shrink-0 text-caption text-muted-foreground">
                      {copy.roles.builtIn}
                    </span>
                  ) : null}
                </p>
                {role.description ? (
                  <p className="truncate text-caption text-muted-foreground">{role.description}</p>
                ) : null}
                <RoleLevelSummary counts={counts} showAsk={showAsk} className="mt-1 lg:hidden" />
                <p className="mt-0.5 text-caption text-muted-foreground sm:hidden">
                  {copy.roles.members(holders.length)}
                </p>
              </SettingsTableCell>
              <SettingsTableCell className="hidden lg:table-cell">
                <RoleLevelSummary counts={counts} showAsk={showAsk} />
              </SettingsTableCell>
              <SettingsTableCell className="hidden sm:table-cell">
                <MemberFaces holders={holders} />
              </SettingsTableCell>
              <SettingsTableCell className="w-px p-0 pr-2 whitespace-nowrap md:last:pr-4">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden md:inline-flex"
                    nativeButton={false}
                    render={<Link href={href} prefetch={false} />}
                  >
                    <ShieldCheck aria-hidden="true" />
                    {canEdit ? copy.roles.editPermissions : copy.roles.viewPermissions}
                  </Button>
                  {canManage && !role.isSystem ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={copy.roles.delete}
                      title={copy.roles.delete}
                      onClick={() => onDelete(role)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  ) : null}
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 text-muted-foreground md:hidden"
                  />
                </div>
              </SettingsTableCell>
            </SettingsTableRow>
          )
        })
      )}
    </SettingsTable>
  )
}

/** Up to three faces (photo or initials) and how many people hold the role. */
function MemberFaces({ holders }: { holders: StaffMemberRow[] }) {
  // Hooks
  const copy = useCopy(staffContent)

  // Render logic
  const shown = holders.slice(0, FACES)
  const more = holders.length - shown.length

  return (
    <div className="flex items-center gap-2">
      {shown.length > 0 ? (
        <span className="flex -space-x-1.5" aria-hidden="true">
          {shown.map((m) => (
            <MemberAvatar
              key={m.id}
              name={m.name}
              email={m.email}
              image={m.image}
              className="size-6 ring-2 ring-card"
              fallbackClassName="text-[0.625rem]"
            />
          ))}
          {more > 0 ? (
            <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[0.625rem] font-semibold text-muted-foreground ring-2 ring-card">
              {copy.roles.moreMembers(more)}
            </span>
          ) : null}
        </span>
      ) : null}
      <span className="text-caption whitespace-nowrap text-muted-foreground">
        {holders.length === 0 ? copy.roles.noMembers : copy.roles.members(holders.length)}
      </span>
    </div>
  )
}
