import { definePlugin } from '@commerce/plugins'
import { s3Factory } from './s3'

/** Listed in commerce.config.ts; a store then installs it from Admin → Apps. */
export const s3Plugin = definePlugin({
  id: 's3',
  name: 'Amazon S3',
  version: '0.1.0',
  kind: 'connection',
  category: 'storage',
  company: 'Amazon Web Services',
  description:
    'Product images and files on your own Amazon S3 bucket, uploaded straight from the browser.',
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
  provides: { storage: [s3Factory] },
  admin: {
    icon: 'Upload',
    pages: [{ path: '', title: 'Connect Amazon S3', navLabel: 'Connect', icon: 'Upload' }],
  },
})
