/** SOURCE OF TRUTH: the Automations app manifest — WHAT: the built-in, free "Automations" app (listing, access, admin pages) that is pre-installed on every store and holds every workflow, the marketing ones (category Marketing) included / WHY: the App Store catalogue, Installed apps and the admin sidebar read apps from manifests; marketing automations moved out of Growth into this app (owner, 2026-10-23, like Shopify 2026). It cannot be uninstalled while marketing workflows exist (`uninstallBlocker`). Free because it is absent from `APP_PRICING`. Imported by commerce.config.ts. */
import { definePlugin } from '@commerce/plugins'

export const AUTOMATIONS_APP_ID = 'automations'

/**
 * Apps every store has from the start (owner, 2026-10-23: Automations is pre-installed, like
 * Shopify Flow, and holds the marketing automations that left Growth). New stores get them at
 * onboarding; the 0154 migration put them on existing stores.
 */
export const PREINSTALLED_APPS: readonly string[] = [AUTOMATIONS_APP_ID]

/**
 * Automations, Koomerce's Shopify Flow: a trigger, conditions and actions across orders,
 * customers and products, with a run log and history on every record. Own code on our outbox,
 * queue and tables; the piece/property shape follows Activepieces (MIT), no code copied.
 */
export const automationsPlugin = definePlugin({
  id: AUTOMATIONS_APP_ID,
  name: 'Automations',
  version: '1.0.0',
  kind: 'builtin',
  category: 'operations',
  description:
    'Do the same small jobs on every order, customer and product automatically: tag, hold, alert your team, message shoppers and more.',
  listing: {
    tagline: 'Tag, hold, alert and message on every order automatically, like Shopify Flow.',
    highlights: [
      'A trigger, conditions and actions, with Then and Otherwise branches',
      'Ready-made templates: high-value orders, risky COD, low stock and more',
      'Run log with every step, and automation history on each order, customer and product',
      'Test on a real order before you switch it on; cancelling asks for approval first',
    ],
    guide: '/merchant-guide/apps/automations',
    worksWith: [
      'Marketing automations (abandoned checkout, welcome, win-back and more), included',
      'Apps that add their own triggers and actions',
    ],
    keywords: [
      'marketing automation',
      'abandoned checkout',
      'flow',
      'workflow',
      'automation',
      'rules',
      'auto tag',
      'shopify flow',
    ],
  },
  access: {
    resources: [
      {
        resource: 'orders',
        level: 'read-write',
        why: 'Checks orders and tags, holds or notes them',
      },
      { resource: 'customers', level: 'read-write', why: 'Checks customers and tags them' },
      { resource: 'products', level: 'read-write', why: 'Checks products and tags them' },
      { resource: 'collections', level: 'write', why: 'Adds products to collections you pick' },
      { resource: 'inventory', level: 'read', why: 'Starts workflows when stock runs low' },
    ],
    summary: 'runs your workflows',
    shares: [
      {
        when: 'Only in workflows with a Send HTTP request step',
        what: 'The data you put in that request, to the address you set',
      },
    ],
  },
  provides: {},
  admin: {
    icon: 'Workflow',
    pages: [
      { path: '', title: 'Workflows', navLabel: 'Workflows', icon: 'Workflow' },
      { path: 'templates', title: 'Templates', navLabel: 'Templates', icon: 'Blocks' },
      { path: 'runs', title: 'Runs', navLabel: 'Runs', icon: 'FileText' },
      { path: 'approvals', title: 'Needs approval', navLabel: 'Needs approval', icon: 'Bell' },
      { path: 'settings', title: 'Settings', navLabel: 'Settings', icon: 'Settings' },
      { path: 'workflows/[id]', title: 'Workflow' },
      { path: 'runs/[id]', title: 'Run' },
    ],
    orderDetailCard: true,
    customerDetailCard: true,
  },
})
