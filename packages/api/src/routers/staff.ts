import { runInvite } from '@commerce/auth'
import {
  forgetInvitation,
  invitationRole,
  listMembers,
  permissions,
  recordInvitationRole,
  upsertMember,
} from '@commerce/core'
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
import {
  type AuthInvitation,
  describePendingInvites,
  findOrganizationInvitation,
  storeNameOf,
} from '../services/staff-invites.service'

const invitationId = z.object({ id: z.string().min(1).max(200) })

type InviteScope = { isOwner: boolean; permissions: readonly string[] }

/** Nobody but the owner may offer a role with more access than their own. */
function assertCanOffer(scope: InviteScope, target: { permissions: readonly string[] }) {
  if (scope.isOwner) return
  const beyond = target.permissions.filter((p) => !scope.permissions.includes(p))
  if (beyond.length > 0) {
    throw new ORPCError('FORBIDDEN', {
      message: 'You cannot invite someone to a role with more access than yours',
    })
  }
}

/** Better Auth's invite calls throw plain errors; the admin shows their message. */
function badRequest(err: Error): never {
  throw new ORPCError('BAD_REQUEST', { message: err.message })
}

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
      image: (m.user as { image?: string | null }).image ?? null,
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
   * `emailSent: false` means the invitation exists but its email did not go: the
   * Staff page says so and lists it under Pending invites with "Resend email".
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
      assertCanOffer(context.scope, target)

      const storeName = await storeNameOf(context.tx, context.scope.storeId)
      const { result: invitation, emailError } = await runInvite(
        { storeName: storeName ?? undefined, roleLabel: target.name },
        () =>
          context.auth.api.createInvitation({
            headers: context.headers,
            body: {
              email: input.email,
              role: 'member',
              organizationId: context.scope.organizationId,
            },
          }),
      ).catch(badRequest)

      const invitationId = (invitation as { id: string }).id
      // Better Auth only knows organization roles; the store role lives here until accept.
      await recordInvitationRole(context.tx, {
        storeId: context.scope.storeId,
        invitationId,
        email: input.email,
        roleId: target.id,
        invitedBy: context.scope.userId,
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
      return { id: invitationId, email: input.email, emailSent: emailError === null }
    }),

  /** Open invitations for this store (expired ones flagged), for the Pending invites list. */
  invitations: can(permissions.STAFF_READ).handler(async ({ context }) => {
    const query = { organizationId: context.scope.organizationId }
    const [invitations, org] = await Promise.all([
      context.auth.api.listInvitations({ headers: context.headers, query }),
      context.auth.api.getFullOrganization({ headers: context.headers, query }),
    ])
    const directory = (org?.members ?? []).map((m) => ({
      id: m.userId,
      email: (m.user as { email?: string | null }).email ?? null,
    }))
    return describePendingInvites(context.tx, {
      storeId: context.scope.storeId,
      organizationId: context.scope.organizationId,
      invitations: invitations as AuthInvitation[],
      directory,
    })
  }),

  /** Withdraws an open invitation; its link stops working straight away. */
  cancelInvitation: can(permissions.STAFF_INVITE)
    .input(invitationId)
    .handler(async ({ context, input }) => {
      const found = await findOrganizationInvitation(
        context.tx,
        context.scope.organizationId,
        input.id,
      )
      if (found?.status !== 'pending') {
        throw new ORPCError('NOT_FOUND', { message: 'Invitation not found' })
      }
      await context.auth.api
        .cancelInvitation({ headers: context.headers, body: { invitationId: input.id } })
        .catch(badRequest)
      await forgetInvitation(context.tx, input.id)
      return { ok: true as const }
    }),

  /**
   * Sends the invitation email again with a fresh expiry. Better Auth keeps the same invitation
   * while it is still open; an expired one is replaced by a new invitation (new link), so the
   * recorded role moves over and the old one is cancelled.
   */
  resendInvitation: can(permissions.STAFF_INVITE)
    .input(invitationId)
    .handler(async ({ context, input }) => {
      const found = await findOrganizationInvitation(
        context.tx,
        context.scope.organizationId,
        input.id,
      )
      if (found?.status !== 'pending') {
        throw new ORPCError('NOT_FOUND', { message: 'Invitation not found' })
      }
      const roleId = await invitationRole(context.tx, context.scope.storeId, input.id)
      const roles = await storeRoles(context.tx, context.scope.storeId)
      const target = roles.find((r) => r.id === roleId) ?? null
      if (target) assertCanOffer(context.scope, target)

      const storeName = await storeNameOf(context.tx, context.scope.storeId)
      const { result, emailError } = await runInvite(
        { storeName: storeName ?? undefined, roleLabel: target?.name },
        () =>
          context.auth.api.createInvitation({
            headers: context.headers,
            body: {
              email: found.email,
              role: 'member',
              organizationId: context.scope.organizationId,
              resend: true,
            },
          }),
      ).catch(badRequest)

      const id = (result as { id: string }).id
      if (id !== input.id) {
        if (target) {
          await recordInvitationRole(context.tx, {
            storeId: context.scope.storeId,
            invitationId: id,
            email: found.email,
            roleId: target.id,
            invitedBy: context.scope.userId,
          })
        }
        await context.auth.api
          .cancelInvitation({ headers: context.headers, body: { invitationId: input.id } })
          .catch(() => undefined)
        await forgetInvitation(context.tx, input.id)
      }
      return { id, email: found.email, emailSent: emailError === null }
    }),
}
