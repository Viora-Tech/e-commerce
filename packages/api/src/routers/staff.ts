import { listMembers, permissions, upsertMember } from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can, storeProcedure } from '../procedures'
import {
  changeMemberRole,
  deleteStoreRole,
  mergeDirectory,
  removeMember,
  saveStoreRole,
  storeRoles,
} from '../services/staff.service'

const roleInput = z.object({
  id: z.uuid().optional(),
  name: z.string().min(1).max(60),
  description: z.string().max(200).nullish(),
  permissions: z.array(z.string()).max(200),
})

/** Team and roles. Reads need staff.read; changes need staff.manage. */
export const staffRouter = {
  /** What the signed-in member may do. Drives which controls the admin renders. */
  me: storeProcedure.handler(({ context }) => ({
    userId: context.scope.userId,
    roleId: context.scope.roleId,
    roleName: context.scope.roleName,
    roleSlug: context.scope.roleSlug,
    isOwner: context.scope.isOwner,
    permissions: context.scope.permissions,
  })),

  members: can(permissions.STAFF_READ).handler(async ({ context }) => {
    const rows = await listMembers(context.tx, context.scope.storeId)
    const org = await context.auth.api.getFullOrganization({
      headers: context.headers,
      query: { organizationId: context.scope.organizationId },
    })
    const directory = (org?.members ?? []).map((m) => ({
      id: m.userId,
      name: (m.user as { name?: string | null }).name ?? null,
      email: (m.user as { email?: string | null }).email ?? null,
    }))
    return mergeDirectory(rows, directory)
  }),

  roles: can(permissions.STAFF_READ).handler(({ context }) =>
    storeRoles(context.tx, context.scope.storeId),
  ),

  saveRole: can(permissions.STAFF_MANAGE)
    .input(roleInput)
    .handler(async ({ context, input }) => {
      try {
        const id = await saveStoreRole(
          context.tx,
          {
            storeId: context.scope.storeId,
            userId: context.scope.userId,
            isOwner: context.scope.isOwner,
            permissions: context.scope.permissions,
          },
          input,
        )
        return { id }
      } catch (err) {
        throw new ORPCError('BAD_REQUEST', { message: (err as Error).message })
      }
    }),

  deleteRole: can(permissions.STAFF_MANAGE)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      try {
        return await deleteStoreRole(context.tx, context.scope.storeId, input.id)
      } catch (err) {
        throw new ORPCError('BAD_REQUEST', { message: (err as Error).message })
      }
    }),

  setMemberRole: can(permissions.STAFF_MANAGE)
    .input(z.object({ memberId: z.uuid(), roleId: z.uuid() }))
    .handler(async ({ context, input }) => {
      try {
        await changeMemberRole(
          context.tx,
          {
            storeId: context.scope.storeId,
            userId: context.scope.userId,
            isOwner: context.scope.isOwner,
            permissions: context.scope.permissions,
          },
          input,
        )
        return { ok: true as const }
      } catch (err) {
        throw new ORPCError('BAD_REQUEST', { message: (err as Error).message })
      }
    }),

  removeMember: can(permissions.STAFF_MANAGE)
    .input(z.object({ memberId: z.uuid() }))
    .handler(async ({ context, input }) => {
      try {
        const { userId } = await removeMember(
          context.tx,
          {
            storeId: context.scope.storeId,
            userId: context.scope.userId,
            isOwner: context.scope.isOwner,
            permissions: context.scope.permissions,
          },
          input.memberId,
        )
        await context.auth.api
          .removeMember({
            headers: context.headers,
            body: {
              memberIdOrEmail: userId,
              organizationId: context.scope.organizationId,
            },
          })
          .catch(() => undefined)
        return { ok: true as const }
      } catch (err) {
        throw new ORPCError('BAD_REQUEST', { message: (err as Error).message })
      }
    }),

  /**
   * Creates the Better Auth invitation (which sends the email) and records the
   * role the person will hold, so they appear on the team page straight away.
   */
  invite: can(permissions.STAFF_INVITE)
    .input(z.object({ email: z.email(), roleId: z.uuid() }))
    .handler(async ({ context, input }) => {
      const roles = await storeRoles(context.tx, context.scope.storeId)
      const target = roles.find((r) => r.id === input.roleId)
      if (!target) throw new ORPCError('BAD_REQUEST', { message: 'Role not found' })
      if (target.slug === 'owner') {
        throw new ORPCError('BAD_REQUEST', { message: 'Invite as administrator, then hand over' })
      }
      if (!context.scope.isOwner) {
        const beyond = target.permissions.filter((p) => !context.scope.permissions.includes(p))
        if (beyond.length > 0) {
          throw new ORPCError('FORBIDDEN', {
            message: 'You cannot invite someone to a role with more access than yours',
          })
        }
      }

      const invitation = await context.auth.api
        .createInvitation({
          headers: context.headers,
          body: {
            email: input.email,
            role: 'member',
            organizationId: context.scope.organizationId,
          },
        })
        .catch((err: Error) => {
          throw new ORPCError('BAD_REQUEST', { message: err.message })
        })

      const invited = (invitation as { userId?: string } | null)?.userId
      if (invited) {
        await upsertMember(context.tx, {
          storeId: context.scope.storeId,
          userId: invited,
          roleId: target.id,
          status: 'invited',
          invitedBy: context.scope.userId,
        })
      }
      return { id: (invitation as { id: string }).id, email: input.email }
    }),
}
