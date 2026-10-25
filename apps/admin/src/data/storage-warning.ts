/** Copy for the warning shown when production keeps uploads on the server's own disk. */
export const storageWarningContent = {
  title: 'Your images are stored on the server disk',
  body: 'They are deleted every time the store is updated, and shoppers may not see them. Connect Cloudflare R2 or Amazon S3 so images stay safe.',
  action: 'Connect storage',
  /** Shown in the Shopify importer before products, images or files come over. */
  importer: {
    title: 'Connect cloud storage first',
    body: 'Images imported now are kept on the server’s disk and can be lost when the store is updated.',
    action: 'Connect storage',
    anyway: 'Import anyway',
  },
}
