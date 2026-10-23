/** SOURCE OF TRUTH: Meta app callbacks — WHAT: WhatsApp webhooks, the deauthorize and data deletion callbacks / WHY: Meta calls the platform's app, naming an account, never a store */
/**
 * What Meta sends to the platform's one Meta app, after the route verified it
 * (`verifyMetaSignature`, `parseMetaSignedRequest`):
 *
 * - WhatsApp webhooks (`object: whatsapp_business_account`), per WhatsApp Business account:
 *   `account_update` (restricted, disabled, the partner removed), `phone_number_quality_update`,
 *   `message_template_status_update`, and failed message statuses. Each lands on the linked
 *   store's `platform_account` row, which the WhatsApp page shows.
 * - Deauthorize and data deletion (`signed_request` naming a Facebook user): every store that
 *   user connected loses its Meta access, catalog listing records and the link. The
 *   confirmation code is signed, so its status page needs nothing stored.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  channelConnection,
  channelListing,
  type Db,
  storesForPlatformAccount,
  withStore,
} from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import { insertOutboxEvent } from '../outbox/write'
import { channelState, isLive, type SalesChannelId } from '../sales-channels/client'
import { loadSalesChannelSettings, patchChannelStates } from '../sales-channels/service'
import { recordPlatformEvent, unlinkPlatformAccount } from './accounts'

/* ---------- WhatsApp webhooks ---------- */

type Change = { field?: string; value?: Record<string, unknown> }
type Entry = { id?: string; changes?: Change[] }
export type MetaWebhookPayload = { object?: string; entry?: Entry[] }

/** `account_update` events that change whether the account can send. */
const ACCOUNT_STATUS: Record<string, string> = {
  ACCOUNT_RESTRICTION: 'restricted',
  ACCOUNT_VIOLATION: 'restricted',
  DISABLED_UPDATE: 'disabled',
  ACCOUNT_DELETED: 'disconnected',
  PARTNER_REMOVED: 'disconnected',
  PARTNER_APP_UNINSTALLED: 'disconnected',
  VERIFIED_ACCOUNT: 'active',
  REINSTATED: 'active',
}

const text = (v: unknown) => (typeof v === 'string' ? v.slice(0, 200) : undefined)

/** One change → what to record on the account: a status, detail keys, or nothing. */
export function whatsappEventUpdate(
  change: Change,
): { status?: string; detail: Record<string, string> } | null {
  const v = change.value ?? {}
  switch (change.field) {
    case 'account_update': {
      const event = text(v.event) ?? ''
      const status = ACCOUNT_STATUS[event]
      return { ...(status ? { status } : {}), detail: { lastAccountEvent: event } }
    }
    case 'phone_number_quality_update':
      return {
        detail: {
          quality: text(v.event) ?? '',
          ...(text(v.current_limit) ? { limit: text(v.current_limit) as string } : {}),
        },
      }
    case 'message_template_status_update':
      return {
        detail: {
          lastTemplate: `${text(v.message_template_name) ?? ''}: ${text(v.event) ?? ''}`,
        },
      }
    case 'messages': {
      const statuses = Array.isArray(v.statuses) ? (v.statuses as Record<string, unknown>[]) : []
      const failed = statuses.find((s) => s.status === 'failed')
      if (!failed) return null
      const errors = Array.isArray(failed.errors)
        ? (failed.errors as Record<string, unknown>[])
        : []
      return { detail: { lastFailure: text(errors[0]?.title) ?? 'A message could not be sent' } }
    }
    default:
      return null
  }
}

/** Applies a verified WhatsApp webhook; answers how many account updates it recorded. */
export async function handleMetaWebhook(
  db: Db,
  payload: MetaWebhookPayload,
  now = new Date(),
): Promise<number> {
  if (payload.object !== 'whatsapp_business_account') return 0
  let recorded = 0
  for (const entry of payload.entry ?? []) {
    if (!entry.id) continue
    const updates = (entry.changes ?? []).map(whatsappEventUpdate).filter((u) => u !== null)
    if (!updates.length) continue
    const merged = updates.reduce<{ status?: string | undefined; detail: Record<string, string> }>(
      (acc, u) => ({ status: u.status ?? acc.status, detail: { ...acc.detail, ...u.detail } }),
      { detail: {} },
    )
    for (const storeId of await storesForPlatformAccount(db, 'whatsapp', entry.id)) {
      if (await recordPlatformEvent(db, storeId, 'whatsapp', entry.id, merged, now)) recorded += 1
    }
  }
  return recorded
}

/* ---------- deauthorize and data deletion ---------- */

const META_CHANNELS: SalesChannelId[] = ['instagram', 'facebook', 'whatsapp']

const codeMac = (body: string, secret: string) =>
  createHmac('sha256', `meta-deletion:${secret}`).update(body).digest('base64url').slice(0, 16)

/** A confirmation code we can recognise later without storing it. */
export function deletionCode(secret: string, now = new Date()): string {
  const body = `${now.getTime().toString(36)}${randomBytes(4).toString('hex')}`
  return `${body}-${codeMac(body, secret)}`
}

export function isDeletionCode(code: string, secret: string): boolean {
  const [body, mac] = code.split('-')
  if (!body || !mac) return false
  const a = Buffer.from(mac)
  const b = Buffer.from(codeMac(body, secret))
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * The Facebook user removed the app or asked for their data to go: every store they connected
 * drops its Meta access and listing records, and its Meta channels end.
 */
export async function forgetMetaUser(db: Db, userId: string, now = new Date()): Promise<number> {
  const stores = await storesForPlatformAccount(db, 'meta', userId)
  for (const storeId of stores) {
    await withStore(db, storeId, async (tx) => {
      const ctx = { tx, storeId }
      const settings = await loadSalesChannelSettings(ctx)
      const ended = Object.fromEntries(
        META_CHANNELS.filter((c) => isLive(channelState(settings, c))).map((c) => {
          const current = channelState(settings, c)
          return [
            c,
            {
              ...current,
              status: 'disconnected' as const,
              sync: { ...current.sync, endedAt: now.toISOString(), message: null },
            },
          ]
        }),
      )
      if (Object.keys(ended).length) await patchChannelStates(ctx, ended)
      await tx
        .delete(channelListing)
        .where(and(eq(channelListing.storeId, storeId), eq(channelListing.provider, 'meta')))
      await tx
        .delete(channelConnection)
        .where(and(eq(channelConnection.storeId, storeId), eq(channelConnection.provider, 'meta')))
      await unlinkPlatformAccount(ctx, 'meta')
      await insertOutboxEvent(tx, storeId, 'meta.access_removed', { platform: 'meta' })
    })
  }
  return stores.length
}
