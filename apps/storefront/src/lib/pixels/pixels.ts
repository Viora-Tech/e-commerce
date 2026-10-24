import 'server-only'
import { parseAppsSettings } from '@commerce/core'
import { browserPixels, PIXELS_APP_ID } from '@commerce/core/pixels/server'
import { storeRead } from '@/lib/store-cache'
import type { BrowserPixel } from './track'

/**
 * The Pixels app's pixels for the consent manager, or null when the store has not installed the
 * app (the old single Meta pixel then keeps working). Cached with the store's data: a write to
 * `pixel_connection` drops it (trigger, migration 0164). Pixel ids and event switches only; the
 * Conversions API token never leaves the server.
 */
export async function storePixels(storeId: string, apps: unknown): Promise<BrowserPixel[] | null> {
  if (!parseAppsSettings(apps).installed.includes(PIXELS_APP_ID)) return null
  return storeRead(storeId, 'pixels', (tx) => browserPixels(tx))
}
