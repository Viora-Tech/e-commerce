import { definePlugin } from '@commerce/plugins'
import { r2Factory } from './r2'

/** Listed in commerce.config.ts; a store then installs it from Admin → Apps. */
export const r2Plugin = definePlugin({
  id: 'r2',
  name: 'Cloudflare R2',
  version: '0.1.0',
  kind: 'connection',
  category: 'storage',
  company: 'Cloudflare',
  tested: true,
  description:
    'Product images and files on your own R2 bucket, uploaded straight from the browser.',
  listing: {
    tagline: 'Keeps your images and files on your own R2 bucket.',
    highlights: [
      'Your files on your own bucket',
      'Uploads straight from the browser',
      'Moves existing files over safely',
    ],
    guide: '/merchant-guide/content/files-and-storage',
    worksWith: ['Products, Files and every app that stores images'],
    keywords: ['storage', 'cloudflare', 'images'],
  },
  access: {
    resources: [
      {
        resource: 'files',
        level: 'read-write',
        why: 'Stores product images and the files you upload',
      },
    ],
    summary: 'stores files',
    shares: [
      { when: 'Every upload', what: 'The file itself: product images, documents and theme files' },
    ],
  },
  provides: { storage: [r2Factory] },
})
