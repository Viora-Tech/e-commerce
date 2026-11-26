/** SOURCE OF TRUTH: Account → Notifications, push devices — WHAT: the member's own browser push subscriptions: turn on and off for this device, list every device with push on, and remove one / WHY: a member must be able to stop pushes on any of their devices, including one they no longer have in hand; every call acts on the caller's own rows only */
import { loadEnv, settingsSecret } from '@commerce/config'
import {
  describeUserAgent,
  listPushDevices,
  PushSubscriptionInputSchema,
  pushDeviceCount,
  removePushDeviceById,
  removePushSubscription,
  savePushSubscription,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { storeProcedure } from '../procedures'

/** The VAPID public key browsers subscribe with; null when push is not set up here. */
export const pushPublicKey = (): string | null => {
  const env = loadEnv(process.env)
  return env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY ? env.VAPID_PUBLIC_KEY : null
}

const EndpointSchema = z.string().url().max(2000)

export const accountPushProcedures = {
  /** Push, "Turn on for this device": saves this browser's subscription for the member. */
  savePushDevice: storeProcedure
    .input(PushSubscriptionInputSchema)
    .handler(async ({ context, input }) => {
      if (!pushPublicKey()) {
        throw new ORPCError('PRECONDITION_FAILED', { message: 'Push is not set up on this server' })
      }
      await savePushSubscription(
        context.tx,
        context.scope.storeId,
        context.scope.userId,
        input,
        settingsSecret(),
      )
      return { devices: await pushDeviceCount(context.tx, context.scope.userId) }
    }),

  /** Push, "Turn off" for this device: forgets the browser's subscription for the member. */
  removePushDevice: storeProcedure
    .input(z.object({ endpoint: EndpointSchema }))
    .handler(async ({ context, input }) => {
      await removePushSubscription(context.tx, context.scope.userId, input.endpoint)
      return { devices: await pushDeviceCount(context.tx, context.scope.userId) }
    }),

  /**
   * Push devices list: every browser or phone the member has push on for in this store, newest
   * first. `endpoint` is this browser's subscription, so its row says "This device".
   */
  pushDevices: storeProcedure
    .input(z.object({ endpoint: EndpointSchema.nullish() }))
    .handler(async ({ context, input }) => {
      const rows = await listPushDevices(context.tx, context.scope.userId, input.endpoint)
      return rows.map((r) => ({
        id: r.id,
        device: describeUserAgent(r.userAgent),
        createdAt: r.createdAt,
        lastOkAt: r.lastOkAt,
        thisDevice: r.thisDevice,
      }))
    }),

  /** Push devices list, "Remove": stops pushes to one of the member's own devices. */
  removePushDeviceById: storeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      const removed = await removePushDeviceById(context.tx, context.scope.userId, input.id)
      if (!removed) throw new ORPCError('NOT_FOUND', { message: 'That device is already removed' })
      return { devices: await pushDeviceCount(context.tx, context.scope.userId) }
    }),
}
