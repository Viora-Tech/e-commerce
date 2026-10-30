/**
 * Every docs page that moved, as [old URL, new URL]. next.config.mjs turns these into permanent
 * redirects, and scripts/check-redirects.mjs checks that every target is a real page. When you
 * move a page, add a line here instead of leaving the old link to break.
 */
export const movedPages = [
  // Merchant guide, regrouped in October 2026 to follow the admin sidebar.
  ['/merchant-guide', '/merchant-guide/start-here/welcome'],
  ['/merchant-guide/set-up-your-store', '/merchant-guide/start-here/set-up-your-store'],
  ['/merchant-guide/going-live', '/merchant-guide/start-here/going-live'],
  ['/merchant-guide/selling/import-from-shopify', '/merchant-guide/start-here/move-from-shopify'],
  ['/merchant-guide/reference/whats-new', '/merchant-guide/start-here/whats-new'],
  ['/merchant-guide/ai-assistant', '/merchant-guide/home/ask-ai'],
  ['/merchant-guide/catalog/orders', '/merchant-guide/orders/orders'],
  ['/merchant-guide/selling/shipments', '/merchant-guide/orders/shipments'],
  ['/merchant-guide/selling/returns', '/merchant-guide/orders/returns-and-rto'],
  ['/merchant-guide/catalog/products-collections', '/merchant-guide/products/products-collections'],
  ['/merchant-guide/catalog/photos', '/merchant-guide/products/photos-and-videos'],
  ['/merchant-guide/stock', '/merchant-guide/stock/overview'],
  ['/merchant-guide/catalog/purchase-orders', '/merchant-guide/stock/purchase-orders'],
  ['/merchant-guide/catalog/customers', '/merchant-guide/customers/customers'],
  ['/merchant-guide/selling/content', '/merchant-guide/content/content-types'],
  ['/merchant-guide/selling/files', '/merchant-guide/content/files-and-storage'],
  ['/merchant-guide/selling/menus-and-redirects', '/merchant-guide/content/menus-and-redirects'],
  ['/merchant-guide/selling/analytics', '/merchant-guide/analytics/overview'],
  ['/merchant-guide/selling/reports', '/merchant-guide/analytics/reports'],
  ['/merchant-guide/selling/visitor-analytics', '/merchant-guide/analytics/visitor-analytics'],
  ['/merchant-guide/money/profit', '/merchant-guide/analytics/profit'],
  ['/merchant-guide/selling/growth', '/merchant-guide/growth/overview'],
  ['/merchant-guide/selling/discounts', '/merchant-guide/discounts'],
  ['/merchant-guide/selling/online-store', '/merchant-guide/online-store/website-builder'],
  [
    '/merchant-guide/selling/build-your-own-section',
    '/merchant-guide/online-store/build-your-own-section',
  ],
  [
    '/merchant-guide/selling/import-shopify-theme',
    '/merchant-guide/online-store/import-a-shopify-theme',
  ],
  ['/merchant-guide/selling/apps', '/merchant-guide/apps/app-store'],
  ['/merchant-guide/selling/reviews', '/merchant-guide/apps/reviews'],
  ['/merchant-guide/money/emi-pay-later', '/merchant-guide/apps/emi-and-pay-later'],
  ['/merchant-guide/money/payments', '/merchant-guide/money-and-gst/payments'],
  ['/merchant-guide/money/cashfree', '/merchant-guide/money-and-gst/cashfree'],
  ['/merchant-guide/money/gst-invoices', '/merchant-guide/money-and-gst/gst-invoices'],
  [
    '/merchant-guide/money/multi-warehouse-gst',
    '/merchant-guide/money-and-gst/several-warehouses-and-gst',
  ],
  ['/merchant-guide/money/security', '/merchant-guide/money-and-gst/security'],
  ['/merchant-guide/reference/glossary', '/merchant-guide/help/glossary'],
  // Older moves, kept working.
  ['/merchant-guide/settings/business-and-gst', '/merchant-guide/settings/taxes'],
  // Rollouts left Settings for the main sidebar (October 30, 2026).
  ['/merchant-guide/settings/rollouts', '/merchant-guide/rollouts'],

  // Developer docs, regrouped into four groups.
  ['/developer-docs/building/architecture', '/developer-docs/getting-started/architecture'],
  ['/developer-docs/building/conventions', '/developer-docs/getting-started/conventions'],
  ['/developer-docs/operations/running-locally', '/developer-docs/getting-started/running-locally'],
  ['/developer-docs/building/request-flow', '/developer-docs/core-concepts/request-flow'],
  ['/developer-docs/building/data-model', '/developer-docs/core-concepts/data-model'],
  ['/developer-docs/building/security', '/developer-docs/core-concepts/security'],
  ['/developer-docs/building/guardrails', '/developer-docs/core-concepts/guardrails'],
  ['/developer-docs/building/admin-languages', '/developer-docs/core-concepts/admin-languages'],
  [
    '/developer-docs/building/admin-design-system',
    '/developer-docs/core-concepts/admin-design-system',
  ],
]
