import { type ChannelState, needsReconnect } from '@commerce/core/sales-channels'
import type { ChannelStatus } from '@/components/sales-channels/channel-status-chip'
import type { SyncTone } from '@/components/sales-channels/sync-status-bar'
import type { salesChannelsContent } from '@/data/sales-channels'

type Copy = typeof salesChannelsContent

/** The chip a channel's connection shows (Figma "Status chip" on cards and headers). */
export function chipStatus(s: ChannelState): ChannelStatus {
  // Disconnected on purpose is not a problem to fix: it reads like never connected.
  if (s.status === 'disconnected') return 'not_connected'
  if (needsReconnect(s)) return 'attention'
  if (s.status === 'syncing' || s.status === 'first_sync') return 'syncing'
  if (s.status === 'paused') return 'paused'
  if (s.status === 'connected') return 'connected'
  if (s.status === 'requested') return 'requested'
  return 'not_connected'
}

/** What the card's button does next. */
export type ChannelAction = 'connect' | 'view_request' | 'reconnect' | 'manage'

export function channelAction(s: ChannelState): ChannelAction {
  if (needsReconnect(s)) return 'reconnect'
  if (s.status === 'requested') return 'view_request'
  if (s.status === 'not_connected') return 'connect'
  return 'manage'
}

export type ChannelBar = {
  tone: SyncTone
  title: string
  detail: string
  /** "Last tried 12 min ago", "Started 1 min ago". */
  metaAt: string | null
  metaKind: 'tried' | 'synced' | 'started' | null
  /** The bar's own button, when it has one. */
  action: 'reconnect' | 'withdraw' | null
  /** 0–1 while products are being sent. */
  progress: number | null
}

/** Figma "Sync status bar" for each connection state (Syncing, Sync error, Access expired…). */
export function channelBar(
  s: ChannelState,
  name: string,
  copy: Copy,
  formatDate: (iso: string) => string,
): ChannelBar {
  const b = copy.bar
  const sync = s.sync
  const progress = sync.total ? Math.min(1, (sync.sent ?? 0) / sync.total) : null
  const base = { metaAt: null, metaKind: null, action: null, progress: null } as const
  switch (s.status) {
    case 'requested':
      return {
        ...base,
        tone: 'pending',
        title: b.requested(name),
        detail: s.requestedAt ? b.requestedBody(formatDate(s.requestedAt)) : b.notConnectedBody,
        action: 'withdraw',
      }
    case 'first_sync':
    case 'syncing':
      return {
        ...base,
        tone: 'pending',
        title: s.status === 'first_sync' ? b.firstSync : b.sharing(name),
        detail: sync.total !== null ? b.sentOf(sync.sent ?? 0, sync.total) : b.firstSyncBody(name),
        metaAt: sync.startedAt,
        metaKind: 'started',
        progress,
      }
    case 'error':
      return {
        ...base,
        tone: 'error',
        title: b.error(name),
        detail: sync.message ?? b.errorBody(name),
        metaAt: sync.lastTriedAt,
        metaKind: 'tried',
        action: 'reconnect',
      }
    case 'expired':
      return {
        ...base,
        tone: 'error',
        title: b.error(name),
        detail: sync.endedAt ? b.expiredBody(name, formatDate(sync.endedAt)) : b.expired,
        metaAt: sync.lastTriedAt,
        metaKind: 'tried',
        action: 'reconnect',
      }
    case 'disconnected':
      return {
        ...base,
        tone: 'idle',
        title: b.disconnected,
        detail: sync.endedAt
          ? b.disconnectedBody(name, formatDate(sync.endedAt))
          : b.notConnectedBody,
        action: 'reconnect',
      }
    case 'paused':
      return { ...base, tone: 'idle', title: b.paused, detail: b.pausedBody(name) }
    case 'connected':
      return {
        ...base,
        tone: 'ok',
        title: b.synced,
        detail: sync.total !== null ? b.sentOf(sync.sent ?? sync.total, sync.total) : b.syncedBody,
        metaAt: sync.lastTriedAt,
        // Healthy: the last try worked, so say so ("Last synced"), not "Last tried" (audit #138).
        metaKind: 'synced',
      }
    default:
      return { ...base, tone: 'idle', title: b.notConnected, detail: b.notConnectedBody }
  }
}
