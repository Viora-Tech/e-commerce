import type { AppBlockSource } from '@commerce/blocks/puck'
import { preorderBlocks } from '@commerce/core/preorder-block'
import { backInStockBlocks } from '@commerce/plugin-back-in-stock/blocks'
import { deliveryCheckerBlocks as delhiveryDeliveryCheckerBlocks } from '@commerce/shipping-delhivery/blocks'
import { deliveryCheckerBlocks as shiprocketDeliveryCheckerBlocks } from '@commerce/shipping-shiprocket/blocks'

/**
 * Client-safe mirror of the app blocks declared on `commerce.config.ts`'s
 * plugins (and the core plugin). The admin's theme editor runs in the
 * browser and cannot import a real `PluginManifest` — those pull in
 * `@commerce/core`'s database driver via `provides`/`hooks` — so it builds
 * its `categories.apps` from this file instead of from `getRegistries()`.
 *
 * Each entry here must mirror one plugin's `id`/`name`/`admin.icon` and the
 * exact same `blocks` array the plugin's own manifest attaches to
 * `storefront.blocks` (imported from the same `./blocks` or
 * `/preorder-block` subpath the manifest itself uses) — there is only one
 * array per app; this file just re-exposes it without the DB-touching
 * imports. Add a plugin here when it ships a block and appears in
 * commerce.config.ts. See docs/plugins.md.
 */
export const APP_BLOCK_SOURCES: AppBlockSource[] = [
  { id: 'core', name: 'Built-in', icon: undefined, blocks: preorderBlocks },
  { id: 'back-in-stock', name: 'Back in stock', icon: 'Bell', blocks: backInStockBlocks },
  { id: 'delhivery', name: 'Delhivery', icon: 'Truck', blocks: delhiveryDeliveryCheckerBlocks },
  { id: 'shiprocket', name: 'Shiprocket', icon: 'Truck', blocks: shiprocketDeliveryCheckerBlocks },
]
