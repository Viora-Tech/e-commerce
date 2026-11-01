'use server'

import 'server-only'

import { loadEnv, settingsSecret } from '@commerce/config'
import {
  CommerceError,
  getCustomerOrder,
  type ReturnPreference,
  requestReturn,
  storageForStore,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { RETURN_PHOTO_MAX_BYTES } from '@commerce/storage/keys'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { returnsContent } from '@/data/returns'
import { currentCustomer } from './customer-session'
import { nudgeOutbox } from './outbox'
import { clientIp, rateLimited } from './rate-limit'
import { inStore } from './store-context'

/*
 * Return request actions. The store comes from the proxy's `x-store-id`
 * header and the shopper from the session, never from the form.
 */

const copy = returnsContent.form.errors

const PHOTO_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const PHOTO_RULE = { limit: 12, windowMs: 10 * 60 * 1000 }
const REQUEST_RULE = { limit: 10, windowMs: 10 * 60 * 1000 }

async function storeId(): Promise<string> {
  const id = (await headers()).get('x-store-id')
  if (!id) throw new Error('store not resolved')
  return id
}

async function shopper(sid: string) {
  const c = await currentCustomer(sid)
  if (!c) redirect('/account/login')
  return c
}

export type PhotoUploadResult = { ok: true; url: string } | { ok: false; error: string }

/**
 * One return photo. The bytes go through the server (not a presigned upload)
 * because the built-in local storage only accepts signed-in staff uploads;
 * this works the same with every storage connection.
 */
export async function uploadReturnPhotoAction(form: FormData): Promise<PhotoUploadResult> {
  const sid = await storeId()
  const me = await shopper(sid)
  const limit = await rateLimited('return-photo:customer', me.id, PHOTO_RULE)
  if (!limit.ok) return { ok: false, error: copy.rateLimited }
  const file = form.get('photo')
  if (!(file instanceof File)) return { ok: false, error: copy.photoFailed }
  const ext = PHOTO_TYPES[file.type.toLowerCase()]
  if (!ext) return { ok: false, error: copy.photoType }
  if (file.size <= 0 || file.size > RETURN_PHOTO_MAX_BYTES)
    return { ok: false, error: copy.photoSize }
  const env = loadEnv(process.env)
  try {
    const provider = await inStore(sid, async (tx) =>
      storageForStore(tx, sid, (await registriesForStore(tx, sid)).storage, env.SETTINGS_SECRET),
    )
    const key = `stores/${sid}/returns/${crypto.randomUUID()}.${ext}`
    await provider.put({
      key,
      body: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
    })
    return { ok: true, url: provider.publicUrl(key) }
  } catch {
    return { ok: false, error: copy.photoFailed }
  }
}

export type ReturnRequestInput = {
  orderNumber: number
  lines: { orderLineId: string; quantity: number }[]
  /** A built-in code, or `custom:<words>` for one of the store's own reasons. */
  reason: string
  note: string
  photos: string[]
  preference: ReturnPreference
  /** For an exchange: the variant wanted instead, per order line. */
  exchange: { orderLineId: string; variantId: string }[]
}

/** Send the request; on success the shopper lands back on the order with a notice. */
export async function submitReturnAction(
  input: ReturnRequestInput,
): Promise<{ error: string } | undefined> {
  const sid = await storeId()
  const me = await shopper(sid)
  const ip = clientIp(await headers())
  const [byCustomer, byIp] = await Promise.all([
    rateLimited('return-request:customer', me.id, REQUEST_RULE),
    rateLimited('return-request:ip', ip, REQUEST_RULE),
  ])
  if (!byCustomer.ok || !byIp.ok) return { error: copy.rateLimited }
  if (!input.lines.some((l) => l.quantity > 0)) return { error: copy.noItems }
  try {
    const sent = await inStore(sid, async (tx) => {
      const ctx = { storeId: sid, tx }
      const found = await getCustomerOrder(ctx, me.id, input.orderNumber)
      if (!found) return false
      // Only photos this shop's storage holds under its returns folder; never an outside URL.
      const storage = await storageForStore(
        tx,
        sid,
        (await registriesForStore(tx, sid)).storage,
        settingsSecret(),
      )
      const prefix = storage.publicUrl(`stores/${sid}/returns/`)
      const photos = input.photos.filter((u) => u.startsWith(prefix) && !u.includes('..'))
      await requestReturn(ctx, {
        orderId: found.id,
        lines: input.lines.filter((l) => l.quantity > 0),
        reason: input.reason,
        note: input.note.slice(0, 1000),
        photos: photos.slice(0, 3),
        requestedBy: 'customer',
        customerId: me.id,
        preference: input.preference,
        exchange: input.preference === 'exchange' ? input.exchange.slice(0, 100) : [],
      })
      return true
    })
    if (!sent) return { error: copy.generic }
  } catch (err) {
    if (err instanceof CommerceError) return { error: err.message }
    return { error: copy.generic }
  }
  await nudgeOutbox(sid)
  revalidatePath(`/account/orders/${input.orderNumber}`)
  redirect(`/account/orders/${input.orderNumber}?return=sent`)
}
