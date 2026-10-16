/**
 * Every admin URL, once. Navigation data, links and redirects read from here instead of
 * spelling "/orders/..." out, so a path moves in one place and the compiler finds every user.
 * Mirrors `src/app/(admin)`: add the route here when you add a page. The `routes` sweep fails
 * on a NEW hardcoded admin href (docs/guardrails.md).
 */

const id = (value: string): string => encodeURIComponent(value)

export const routes = {
  home: () => '/',
  login: () => '/login',
  onboarding: () => '/onboarding',
  selectStore: () => '/select-store',
  acceptInvitation: (invitationId: string) => `/accept-invitation/${id(invitationId)}`,

  account: {
    /** Profile: the page the account menu's "Account" opens. */
    home: () => '/account',
    security: () => '/account/security',
    sessions: () => '/account/sessions',
    notifications: () => '/account/notifications',
    stores: () => '/account/stores',
    language: () => '/account/language',
    appearance: () => '/account/appearance',
  },

  orders: {
    list: () => '/orders',
    detail: (orderId: string) => `/orders/${id(orderId)}`,
    bulkEdit: () => '/orders/bulk-edit',
    drafts: () => '/orders/drafts',
    newDraft: () => '/orders/drafts/new',
    draft: (draftId: string) => `/orders/drafts/${id(draftId)}`,
    abandonedCheckouts: () => '/orders/abandoned-checkouts',
    abandonedCheckout: (cartId: string) => `/orders/abandoned-checkouts/${id(cartId)}`,
    shipments: () => '/orders/shipments',
    returns: () => '/orders/returns',
    returnDetail: (returnId: string) => `/orders/returns/${id(returnId)}`,
  },

  products: {
    list: () => '/products',
    new: () => '/products/new',
    bulkEdit: (productIds: string[]) => `/products/bulk-edit?ids=${productIds.map(id).join(',')}`,
    detail: (productId: string) => `/products/${id(productId)}`,
    collections: () => '/products/collections',
    newCollection: () => '/products/collections/new',
    collection: (collectionId: string) => `/products/collections/${id(collectionId)}`,
    giftCards: () => '/products/gift-cards',
    newGiftCard: () => '/products/gift-cards/new',
    giftCard: (giftCardId: string) => `/products/gift-cards/${id(giftCardId)}`,
  },

  /** Buying and moving stock: inventory, purchase orders, inbound shipments, suppliers, transfers. */
  stock: {
    home: () => '/stock',
    inventory: () => '/stock/inventory',
    purchaseOrders: () => '/stock/purchase-orders',
    newPurchaseOrder: () => '/stock/purchase-orders/new',
    purchaseOrder: (purchaseOrderId: string) => `/stock/purchase-orders/${id(purchaseOrderId)}`,
    transfers: () => '/stock/transfers',
    newTransfer: () => '/stock/transfers/new',
    transfer: (transferId: string) => `/stock/transfers/${id(transferId)}`,
    suppliers: () => '/stock/suppliers',
    newSupplier: () => '/stock/suppliers/new',
    supplier: (supplierId: string) => `/stock/suppliers/${id(supplierId)}`,
    inboundShipments: () => '/stock/inbound-shipments',
    newInboundShipment: () => '/stock/inbound-shipments/new',
    inboundShipment: (shipmentId: string) => `/stock/inbound-shipments/${id(shipmentId)}`,
  },

  customers: {
    list: () => '/customers',
    detail: (customerId: string) => `/customers/${id(customerId)}`,
    segments: () => '/customers/segments',
    newSegment: () => '/customers/segments/new',
    segment: (segmentId: string) => `/customers/segments/${id(segmentId)}`,
  },

  content: {
    home: () => '/content',
    files: () => '/content/files',
    storage: () => '/content/files/storage',
    menus: () => '/content/menus',
    menu: (menuId: string) => `/content/menus/${id(menuId)}`,
    redirects: () => '/content/menus/redirects',
    contentTypes: () => '/content/metaobjects',
    newContentType: () => '/content/metaobjects/new',
    newBlankContentType: () => '/content/metaobjects/new/blank',
    contentType: (type: string) => `/content/metaobjects/${id(type)}`,
    contentTypeDefinition: (type: string) => `/content/metaobjects/${id(type)}/definition`,
    newEntry: (type: string) => `/content/metaobjects/${id(type)}/new`,
    entry: (type: string, entryId: string) => `/content/metaobjects/${id(type)}/${id(entryId)}`,
    blogPosts: () => '/content/blog-posts',
    newBlogPost: () => '/content/blog-posts/new',
    blogPost: (postId: string) => `/content/blog-posts/${id(postId)}`,
    blogs: () => '/content/blog-posts/blogs',
  },

  analytics: {
    home: () => '/analytics',
    live: () => '/analytics/live',
    reports: () => '/analytics/reports',
    report: (slug: string) => `/analytics/reports/${id(slug)}`,
  },

  growth: {
    home: () => '/growth',
    campaigns: () => '/growth/campaigns',
    newCampaign: () => '/growth/campaigns/new',
    campaign: (campaignId: string) => `/growth/campaigns/${id(campaignId)}`,
    automations: () => '/growth/automations',
    automation: (automationId: string) => `/growth/automations/${id(automationId)}`,
    links: () => '/growth/links',
  },

  discounts: {
    list: () => '/discounts',
    new: () => '/discounts/new',
    detail: (discountId: string) => `/discounts/${id(discountId)}`,
  },

  onlineStore: {
    home: () => '/online-store',
    themes: () => '/online-store/themes',
    themeEditor: (themeId: string) => `/online-store/themes/${id(themeId)}/editor`,
    themeImportNew: () => '/online-store/themes/import',
    themeImport: (themeId: string) => `/online-store/themes/${id(themeId)}/import`,
    pages: () => '/online-store/pages',
    page: (pageId: string) => `/online-store/pages/${id(pageId)}`,
    pageContent: (pageId: string) => `/online-store/pages/${id(pageId)}/content`,
    blog: () => '/online-store/blog',
    preferences: () => '/online-store/preferences',
    seo: () => '/online-store/seo',
  },

  apps: {
    list: () => '/apps',
    /** An installed app's own screen: `/apps/<pluginId>/<...path>`. */
    page: (pluginId: string, ...path: string[]) =>
      ['/apps', id(pluginId), ...path.map(id)].join('/'),
    connect: (providerId: string) => `/apps/${id(providerId)}/connect`,
    settings: (appId: string) => `/apps/${id(appId)}/settings`,
  },

  settings: {
    home: () => '/settings',
    store: () => '/settings/store',
    payments: () => '/settings/payments',
    paymentsAdvanced: () => '/settings/payments/advanced',
    checkout: () => '/settings/checkout',
    shipping: () => '/settings/shipping',
    newShippingZone: () => '/settings/shipping/zones/new',
    shippingZone: (zoneId: string) => `/settings/shipping/zones/${id(zoneId)}`,
    taxes: () => '/settings/taxes',
    costs: () => '/settings/costs',
    locations: () => '/settings/locations',
    location: (locationId: string) => `/settings/locations/${id(locationId)}`,
    domains: () => '/settings/domains',
    domain: (domainId: string) => `/settings/domains/${id(domainId)}`,
    notifications: () => '/settings/notifications',
    policies: () => '/settings/policies',
    policy: (type: string) => `/settings/policies/${id(type)}`,
    privacy: () => '/settings/privacy',
    privacyBanner: () => '/settings/privacy#banner',
    privacyRequests: () => '/settings/privacy/requests',
    privacyRequest: (requestId: string) => `/settings/privacy/requests/${id(requestId)}`,
    customerAccounts: () => '/settings/customer-accounts',
    customData: () => '/settings/custom-data',
    returns: () => '/settings/returns',
    staff: () => '/settings/staff',
    ai: () => '/settings/ai',
  },

  dev: {
    editor: () => '/dev/editor',
    emails: () => '/dev/emails',
    email: (template: string) => `/dev/emails/${id(template)}`,
  },
} as const
