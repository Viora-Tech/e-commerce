import { definePlugin } from '@commerce/plugins'
import { z } from 'zod'
import { SHOPIFY_IMPORT_ID, SNAPSHOT_CLEANUP_JOB } from './client'
import { executeRun } from './run'
import { failInterruptedRun } from './service'
import { cleanupSnapshots } from './snapshot'

const RunJob = z.object({ runId: z.uuid() })

/**
 * Move a store from Shopify: products, customers and orders from Shopify's CSV
 * exports, or everything (collections, pages, blog posts, menus, redirects,
 * files, content types, extra fields, discounts and gift card balances
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
    'Bring products, collections, customers, orders, pages, blog posts, menus, redirects, files, content types, extra fields, discounts and gift card balances over from Shopify.',
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
          // An import queues thousands of images: they take the faster bulk encode.
          processMedia: ctx.processMedia
            ? (mediaId) => ctx.processMedia?.(mediaId, { bulk: true }) ?? Promise.resolve()
            : undefined,
        },
        RunJob.parse(data).runId,
      )
    },
    /** Queued by the worker's hourly sweep for stores with a preview copy over 7 days old. */
    [SNAPSHOT_CLEANUP_JOB]: async (ctx) => {
      const removed = await cleanupSnapshots({ inStore: ctx.inStore, storage: ctx.storage })
      if (removed) ctx.log(`removed ${removed} old preview ${removed === 1 ? 'copy' : 'copies'}`)
    },
  },
  jobFailed: {
    /** The worker died under the import (or it threw on every try): end the run so the page offers Try again. */
    run: async (ctx, data, reason) => {
      const parsed = RunJob.safeParse(data)
      if (!parsed.success) return
      const ended = await ctx.inStore((tx) => failInterruptedRun(tx, parsed.data.runId))
      if (ended) ctx.log(`run ${parsed.data.runId} marked failed: ${reason}`)
    },
  },
  admin: {
    icon: 'Download',
    pages: [
      { path: '', title: 'Imports', navLabel: 'Imports', icon: 'Download' },
      { path: 'csv', title: 'Upload CSV files', navLabel: 'CSV files', icon: 'Upload' },
      { path: 'connect', title: 'Connect Shopify', navLabel: 'Connect store', icon: 'Store' },
      { path: 'settings', title: 'Store settings', navLabel: 'Store settings', icon: 'Settings' },
      { path: 'runs/[id]', title: 'Import' },
    ],
  },
})
