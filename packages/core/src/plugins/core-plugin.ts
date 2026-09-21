import { definePlugin } from '@commerce/plugins'
import { fakeShippingFactory } from '@commerce/shipping'
import { codFactory } from '../providers/cod'
import { logChannelFactory } from '../providers/log-channel'
import { manualFactory } from '../providers/manual'

/**
 * What every deployment has without installing anything: cash on delivery,
 * manual UPI/bank transfer, the demo courier and the console log channel.
 * Loaded first, always installed, never shown with an uninstall button.
 */
export const corePlugin = definePlugin({
  id: 'core',
  name: 'Built-in',
  version: '0.1.0',
  description:
    'Cash on delivery, UPI or bank transfer, demo courier and the development log channel.',
  provides: {
    payments: [codFactory, manualFactory],
    shipping: [fakeShippingFactory],
    notifications: [logChannelFactory],
  },
})
