import { settingsSecret } from '@commerce/config'
import { recordMessageOpen, verifyMessageToken } from '@commerce/core'
import { headers } from 'next/headers'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ token: string }> }

/** A transparent 1x1 GIF. */
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

/**
 * Open pixel in marketing emails. Always answers with the image, whatever the
 * token, so a broken or forged link never shows a broken image; only a valid
 * token for the store this host serves records the open.
 */
export async function GET(_request: Request, { params }: Params) {
  const { token } = await params
  const storeId = (await headers()).get('x-store-id')
  const payload = verifyMessageToken(token, settingsSecret())
  if (payload && storeId && payload.storeId === storeId) {
    try {
      await inStore(storeId, (tx) => recordMessageOpen(tx, payload.messageId))
    } catch (err) {
      console.warn('[marketing] could not record an open', err)
    }
  }
  return new Response(PIXEL, {
    headers: {
      'content-type': 'image/gif',
      'cache-control': 'no-store, max-age=0',
    },
  })
}
