import { definePlugin } from '@commerce/plugins'
import { r2Factory } from './r2'

/** Listed in commerce.config.ts; a store then installs it from Admin → Apps. */
export const r2Plugin = definePlugin({
  id: 'r2',
  name: 'Cloudflare R2',
  version: '0.1.0',
  description:
    'Product images and files on your own R2 bucket, uploaded straight from the browser.',
  provides: { storage: [r2Factory] },
})
