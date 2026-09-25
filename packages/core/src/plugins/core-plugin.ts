import { definePlugin } from '@commerce/plugins'
import { fakeShippingFactory } from '@commerce/shipping'
import { migrateStorage } from '../media/migrate'
import { codFactory } from '../providers/cod'
import { localStorageFactory } from '../providers/local-storage'
import { logChannelFactory } from '../providers/log-channel'
import { manualFactory } from '../providers/manual'

/**
 * What every deployment has without installing anything: cash on delivery,
 * manual UPI/bank transfer, the demo courier, the console log channel and
 * local-folder file storage.
 * Loaded first, always installed, never shown with an uninstall button.
 */
export const corePlugin = definePlugin({
  id: 'core',
  name: 'Built-in',
  version: '0.1.0',
  kind: 'builtin',
  description:
    'Cash on delivery, UPI or bank transfer, demo courier, development log channel and local file storage.',
  provides: {
    payments: [codFactory, manualFactory],
    shipping: [fakeShippingFactory],
    notifications: [logChannelFactory],
    storage: [localStorageFactory],
  },
  // Its storefront block (the pre-order countdown) is not attached here: doing so would
  // pull @commerce/blocks — a React/DOM package — into the compile graph of every one of
  // this manifest's many consumers (the worker, the API, every plugin). Callers that
  // build the live app-blocks config (the storefront route, commerce.blocks.config.ts for
  // the admin editor) attach `@commerce/core/preorder-block`'s `preorderBlocks` onto the
  // 'core' source themselves instead. See docs/plugins.md.
  jobs: {
    /** "Move existing files to <connection>": see packages/core/src/media/migrate.ts. */
    migrateStorage,
  },
})
