/**
 * The catalog sync for one platform connection (`meta`, `google`, `openai`): build the items,
 * send what changed (deleting what left), and move each channel on it through its states:
 * `first_sync`/`connected` → `syncing` → `connected`, or `error` with the platform's words, or
 * `expired` when the access lapsed. Runs from the worker (every few hours, and "Sync now");
 * no database transaction stays open while a platform answers.
 */
import {
  type ChannelProvider,
  channelConnection,
  channelListing,
  type Db,
  store,
  withStore,
} from '@commerce/db'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { storefrontOriginFor } from '../domains/origin'
import { encryptSecret } from '../secrets'
import { buildChannelCatalog, type ChannelItem, itemHash } from './catalog'
import { type ChannelState, channelState, type SalesChannelId } from './client'
import { type ChannelDeps, channelsOf, loadConnection, readToken } from './connect'
import {
  ChannelApiError,
  googlePushItems,
  googleRefresh,
  metaPushItems,
  openAiPushFeed,
} from './providers'
import { loadSalesChannelSettings, patchChannelStates } from './service'

/** One store's sync for one platform; the worker's sweep queues one per connection. */
export const CHANNEL_SYNC_QUEUE = '{channels}-sync'

export type ChannelSyncJob = { storeId: string; provider: ChannelProvider } | { sweep: true }

export type ChannelSyncQueue = {
  add(
    name: string,
    data: ChannelSyncJob,
    opts?: { jobId?: string; attempts?: number; removeOnComplete?: boolean; delay?: number },
  ): Promise<unknown>
}

/** How often every connected catalog is synced again. */
export const CHANNEL_SYNC_EVERY_MS = 6 * 60 * 60_000

/** `excluded.<column>` in an upsert: the value the insert tried to write. */
const sqlExcluded = (column: string) => sql.raw(`excluded.${column}`)

/** States a sync works for; paused, ended and requested channels are left alone. */
const SYNCING_FROM: readonly ChannelState['status'][] = [
  'first_sync',
  'connected',
  'syncing',
  'error',
]

export type ChannelSyncResult =
  | { state: 'skipped' }
  | { state: 'synced'; items: number; sent: number; removed: number }
  | { state: 'failed'; message: string; reconnect: boolean }

function patchAll(
  channels: SalesChannelId[],
  states: Record<string, ChannelState>,
  fn: (s: ChannelState) => ChannelState,
) {
  return Object.fromEntries(channels.map((c) => [c, fn(states[c] as ChannelState)]))
}

/** One provider's sync for one store. */
export async function syncChannelProvider(
  db: Db,
  storeId: string,
  provider: ChannelProvider,
  deps: ChannelDeps,
  now: () => Date = () => new Date(),
): Promise<ChannelSyncResult> {
  // 1. What to send, and to whom, in one short read.
  const plan = await withStore(db, storeId, async (tx) => {
    const ctx = { tx, storeId }
    const [connection, settings] = await Promise.all([
      loadConnection(ctx, provider),
      loadSalesChannelSettings(ctx),
    ])
    if (!connection) return null
    const channels = channelsOf(provider).filter((c) =>
      SYNCING_FROM.includes(channelState(settings, c).status),
    )
    if (!channels.length) return null
    const states = Object.fromEntries(channels.map((c) => [c, channelState(settings, c)]))
    const origin = await storefrontOriginFor(tx, storeId, deps.storefrontUrl)
    const items = await buildChannelCatalog(tx, storeId, {
      origin,
      agents: provider === 'openai' ? settings.agents : undefined,
    })
    const listed = await tx
      .select({ itemId: channelListing.itemId, hash: channelListing.hash })
      .from(channelListing)
      .where(and(eq(channelListing.storeId, storeId), eq(channelListing.provider, provider)))
    const [s] = await tx.select({ name: store.name }).from(store).where(eq(store.id, storeId))
    const startedAt = now().toISOString()
    await patchChannelStates(
      ctx,
      patchAll(channels, states, (st) => ({
        ...st,
        status: st.status === 'first_sync' ? 'first_sync' : 'syncing',
        sync: { ...st.sync, sent: 0, total: items.length, startedAt, message: null },
      })),
    )
    return { connection, channels, states, items, listed, origin, storeName: s?.name ?? '' }
  })
  if (!plan) return { state: 'skipped' }

  const { connection, channels, items } = plan
  const before = new Map(plan.listed.map((l) => [l.itemId, l.hash]))
  const hashes = new Map(items.map((i) => [i.id, itemHash(i)]))
  const changed: ChannelItem[] =
    provider === 'openai' ? items : items.filter((i) => before.get(i.id) !== hashes.get(i.id))
  const removed = [...before.keys()].filter((id) => !hashes.has(id))

  // 2. Send, outside any transaction.
  try {
    let token = readToken(connection.accessToken, deps.secret)
    if (provider === 'meta') {
      if (connection.expiresAt && connection.expiresAt <= now())
        throw new ChannelApiError('auth', 'Facebook access ran out. Connect again to keep syncing.')
      if (!deps.meta) throw new ChannelApiError('api', 'Facebook connections are not set up.')
      await metaPushItems(deps.fetch, deps.meta, token, connection.target ?? '', changed, removed)
    } else if (provider === 'google') {
      if (!deps.google) throw new ChannelApiError('api', 'Google connections are not set up.')
      if (!connection.expiresAt || connection.expiresAt.getTime() - now().getTime() < 60_000) {
        if (!connection.refreshToken) throw new ChannelApiError('auth', 'Google access ran out.')
        const fresh = await googleRefresh(
          deps.fetch,
          deps.google,
          readToken(connection.refreshToken, deps.secret),
        )
        token = fresh.accessToken
        await withStore(db, storeId, (tx) =>
          tx
            .update(channelConnection)
            .set({
              accessToken: encryptSecret(fresh.accessToken, deps.secret),
              expiresAt: fresh.expiresAt,
              updatedAt: now(),
            })
            .where(eq(channelConnection.id, connection.id)),
        )
      }
      await googlePushItems(
        deps.fetch,
        token,
        { accountId: connection.accountId ?? '', dataSource: connection.target ?? '' },
        changed,
        removed,
      )
    } else {
      await openAiPushFeed(
        deps.fetch,
        { endpoint: connection.target ?? '', apiKey: token },
        items,
        { name: plan.storeName, url: plan.origin },
      )
    }
  } catch (err) {
    const reconnect = err instanceof ChannelApiError && err.kind === 'auth'
    const message =
      err instanceof ChannelApiError
        ? err.message
        : 'The sync stopped unexpectedly. It will try again.'
    const at = now().toISOString()
    await withStore(db, storeId, (tx) =>
      patchChannelStates(
        { tx, storeId },
        patchAll(channels, plan.states, (st) => ({
          ...st,
          status: reconnect ? 'expired' : 'error',
          sync: { ...st.sync, lastTriedAt: at, message, ...(reconnect ? { endedAt: at } : {}) },
        })),
      ),
    )
    if (!(err instanceof ChannelApiError)) throw err
    return { state: 'failed', message, reconnect }
  }

  // 3. Remember what the platform now holds, and say so.
  const at = now()
  await withStore(db, storeId, async (tx) => {
    if (removed.length)
      await tx
        .delete(channelListing)
        .where(
          and(
            eq(channelListing.storeId, storeId),
            eq(channelListing.provider, provider),
            inArray(channelListing.itemId, removed),
          ),
        )
    for (let i = 0; i < changed.length; i += 500) {
      const rows = changed.slice(i, i + 500).map((item) => ({
        storeId,
        provider,
        itemId: item.id,
        hash: hashes.get(item.id) as string,
        syncedAt: at,
      }))
      await tx
        .insert(channelListing)
        .values(rows)
        .onConflictDoUpdate({
          target: [channelListing.storeId, channelListing.provider, channelListing.itemId],
          set: { hash: sqlExcluded('hash'), syncedAt: at },
        })
    }
    await patchChannelStates(
      { tx, storeId },
      patchAll(channels, plan.states, (st) => ({
        ...st,
        status: 'connected',
        sync: {
          ...st.sync,
          sent: items.length,
          total: items.length,
          lastTriedAt: at.toISOString(),
          endedAt: null,
          message: null,
        },
      })),
    )
  })
  return { state: 'synced', items: items.length, sent: changed.length, removed: removed.length }
}
