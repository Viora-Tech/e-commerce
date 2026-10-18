import { loadEnv } from '@commerce/config'
import {
  AgentControlsSchema,
  type ChannelDeps,
  type ChannelSyncQueue,
  ConnectRequestSchema,
  canConnectNow,
  cancelChannel,
  channelApps,
  disconnectChannel,
  loadAgentControls,
  loadAgenticOverview,
  loadCatalogReadiness,
  loadSocialOverview,
  OpenAiFeedSchema,
  PROVIDER_OF,
  permissions,
  type SalesChannelId,
  SOCIAL_CHANNELS,
  saveAgentControls,
  saveOpenAiFeed,
  setChannelPaused,
  startChannelConnect,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'

/** Meta, Google and OpenAI access as the admin builds it (the worker builds the same). */
export function channelDeps(): ChannelDeps {
  const env = loadEnv(process.env)
  return {
    fetch,
    secret: env.SETTINGS_SECRET,
    ...channelApps(process.env),
    adminUrl: env.ADMIN_URL,
    storefrontUrl: env.STOREFRONT_URL,
  }
}

/** Queues a sync of the platform behind `channel`, if the host has a queue (tests do not). */
export async function queueChannelSync(
  queue: ChannelSyncQueue | undefined,
  storeId: string,
  channel: SalesChannelId,
): Promise<void> {
  const provider = PROVIDER_OF[channel]
  if (!queue || !provider) return
  await queue.add(
    'sync',
    { storeId, provider },
    { jobId: `channel-sync:${storeId}:${provider}:${Date.now()}`, removeOnComplete: true },
  )
}

const ChannelInput = z.object({ channel: ConnectRequestSchema.shape.channel })

/** Sales channels → Agentic sales and Social media. */
export const salesChannelsRouter = {
  agentic: can(permissions.ONLINE_STORE_READ).handler(({ context }) =>
    loadAgenticOverview({ tx: context.tx, storeId: context.scope.storeId }),
  ),
  readiness: can(permissions.ONLINE_STORE_READ).handler(({ context }) =>
    loadCatalogReadiness({ tx: context.tx, storeId: context.scope.storeId }),
  ),
  controls: can(permissions.ONLINE_STORE_READ).handler(({ context }) =>
    loadAgentControls({ tx: context.tx, storeId: context.scope.storeId }),
  ),
  saveControls: can(permissions.ONLINE_STORE_WRITE)
    .input(AgentControlsSchema)
    .handler(({ context, input }) =>
      saveAgentControls({ tx: context.tx, storeId: context.scope.storeId }, input),
    ),
  /** One social channel, and whether Connect signs in to the platform now or sends a request. */
  social: can(permissions.ONLINE_STORE_READ)
    .input(z.object({ channel: z.enum(SOCIAL_CHANNELS) }))
    .handler(async ({ context, input }) => ({
      ...(await loadSocialOverview(
        { tx: context.tx, storeId: context.scope.storeId },
        input.channel,
      )),
      connectNow: canConnectNow(input.channel, channelApps(process.env)),
    })),
  /**
   * "Connect": a URL to sign in at Meta or Google, the channel joining a platform the store
   * already connected, or (no platform app yet) a request.
   */
  connect: can(permissions.ONLINE_STORE_WRITE)
    .input(ConnectRequestSchema)
    .handler(async ({ context, input }) => {
      const r = await startChannelConnect(
        { tx: context.tx, storeId: context.scope.storeId },
        input,
        channelDeps(),
      )
      if (r.kind === 'connected')
        await queueChannelSync(context.channelSync, context.scope.storeId, input.channel)
      return r
    }),
  cancel: can(permissions.ONLINE_STORE_WRITE)
    .input(ChannelInput)
    .handler(({ context, input }) =>
      cancelChannel({ tx: context.tx, storeId: context.scope.storeId }, input.channel),
    ),
  /** "Sync now": the platform gets this store's catalog again within a minute. */
  syncNow: can(permissions.ONLINE_STORE_WRITE)
    .input(ChannelInput)
    .handler(async ({ context, input }) => {
      if (!PROVIDER_OF[input.channel])
        throw new ORPCError('BAD_REQUEST', { message: 'This channel does not sync yet.' })
      await queueChannelSync(context.channelSync, context.scope.storeId, input.channel)
      return { queued: Boolean(context.channelSync) }
    }),
  pause: can(permissions.ONLINE_STORE_WRITE)
    .input(ChannelInput.extend({ paused: z.boolean() }))
    .handler(async ({ context, input }) => {
      const state = await setChannelPaused(
        { tx: context.tx, storeId: context.scope.storeId },
        input.channel,
        input.paused,
      )
      if (!input.paused)
        await queueChannelSync(context.channelSync, context.scope.storeId, input.channel)
      return state
    }),
  disconnect: can(permissions.ONLINE_STORE_WRITE)
    .input(ChannelInput)
    .handler(({ context, input }) =>
      disconnectChannel({ tx: context.tx, storeId: context.scope.storeId }, input.channel),
    ),
  /** ChatGPT, once OpenAI approved the store: their feed address and key. */
  saveOpenAiFeed: can(permissions.ONLINE_STORE_WRITE)
    .input(OpenAiFeedSchema)
    .handler(async ({ context, input }) => {
      const state = await saveOpenAiFeed(
        { tx: context.tx, storeId: context.scope.storeId },
        input,
        channelDeps().secret,
      )
      await queueChannelSync(context.channelSync, context.scope.storeId, 'chatgpt')
      return state
    }),
}
