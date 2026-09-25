import { definePlugin } from '@commerce/plugins'
import { z } from 'zod'
import { SHOPIFY_IMPORT_ID } from './client'
import { executeRun } from './run'

const RunJob = z.object({ runId: z.uuid() })

/**
 * Move a store from Shopify: products, customers and orders from Shopify's CSV
 * exports, or everything (collections, pages, blog posts, menus and redirects
 * too) over the Admin API with a custom-app token. Every run can be previewed
 * first and repeated safely. Historical orders arrive read-only: no stock,
 * messages, invoices or app hooks.
 */
export const shopifyImportPlugin = definePlugin({
  id: SHOPIFY_IMPORT_ID,
  name: 'Shopify importer',
  version: '1.0.0',
  kind: 'builtin',
  category: 'migration',
  description:
    'Bring products, collections, customers, orders, pages, blog posts, menus and redirects over from Shopify.',
  provides: {},
  jobs: {
    run: async (ctx, data) => {
      await executeRun(
        {
          storeId: ctx.storeId,
          inStore: ctx.inStore,
          storage: ctx.storage,
          settingsSecret: ctx.settingsSecret,
          log: ctx.log,
        },
        RunJob.parse(data).runId,
      )
    },
  },
  admin: {
    icon: 'Download',
    pages: [
      { path: '', title: 'Imports', navLabel: 'Imports', icon: 'Download' },
      { path: 'csv', title: 'Upload CSV files', navLabel: 'CSV files', icon: 'Upload' },
      { path: 'connect', title: 'Connect Shopify', navLabel: 'Connect store', icon: 'Store' },
      { path: 'runs/[id]', title: 'Import' },
    ],
  },
})
