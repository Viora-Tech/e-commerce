/**
 * Every admin URL, once. Navigation data, links and redirects read from here instead of
 * spelling "/orders/..." out, so a path moves in one place and the compiler finds every user.
 * Mirrors `src/app/(admin)`: add the route here when you add a page. The `routes` sweep fails
 * on a NEW hardcoded admin href (docs/guardrails.md).
 */

const id = (value: string): string => encodeURIComponent(value)

/** The Meta surfaces (`META_CHANNELS` in @commerce/core), kept here so routes import nothing. */
const META_SURFACES = ['facebook', 'instagram', 'whatsapp']

/**
 * A `?next=` worth following: a path on this admin only (`/oauth/authorize?…`), never another
 * site (`//evil.com`, a backslash, `https://…`). Anything else is null.
 */
export function safeNext(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null
  // Browsers drop tabs and newlines and read `\` as `/`, so `/\t/evil.com` is `//evil.com`.
  const unsafe = [...value].some((c) => c === '\\' || c.charCodeAt(0) < 32)
  if (!value.startsWith('/') || value.startsWith('//') || unsafe) return null
  return value
}

/** A full URL outside the admin (the App Store website): open it in a new tab, not the router. */
export const isExternalHref = (href: string) => /^https?:\/\//.test(href)

/** Where Products → Write with AI was opened from: its back link and Close lead there. */
export type BulkWriteFrom = 'products' | 'seo' | 'readiness'

type BulkWriteTarget = {
  ids?: string[]
  job?: string
  fields?: string[]
  from?: BulkWriteFrom
}

export const routes = {
  home: () => '/',
  /** `next`: where to go after signing in (an OAuth consent page); see `safeNext`. */
  login: (next?: string) => (next ? `/login?next=${id(next)}` : '/login'),
  /** The consent page an MCP client opens to sign in ("Allow Claude to use Waimers?"). */
  oauthAuthorize: () => '/oauth/authorize',
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
    ship: (orderId: string) => `/orders/${id(orderId)}/ship`,
    /** Edit a placed order's items, shipping and discount (review, then save). */
    edit: (orderId: string) => `/orders/${id(orderId)}/edit`,
    /** An order opened from Shipments: Create shipment until it is booked, then the order page
     *  at its shipment card. Under /orders/shipments so the sidebar keeps Shipments lit. */
    shipment: (orderId: string) => `/orders/shipments/${id(orderId)}`,
    bulkEdit: () => '/orders/bulk-edit',
    /** Packing slips for these orders, one per page, printed straight away. */
    packingSlips: (orderIds: string[]) => `/orders/packing-slips?ids=${orderIds.map(id).join(',')}`,
    drafts: () => '/orders/drafts',
    newDraft: () => '/orders/drafts/new',
    draft: (draftId: string) => `/orders/drafts/${id(draftId)}`,
    abandonedCheckouts: () => '/orders/abandoned-checkouts',
    abandonedCheckout: (cartId: string) => `/orders/abandoned-checkouts/${id(cartId)}`,
    shipments: () => '/orders/shipments',
    /** Pickups and manifests for booked parcels. */
    shipmentPickups: () => '/orders/shipments/pickups',
    /** Deliveries the courier could not make (NDR). */
    shipmentProblems: () => '/orders/shipments/attention',
    returns: () => '/orders/returns',
    returnDetail: (returnId: string) => `/orders/returns/${id(returnId)}`,
  },

  products: {
    list: () => '/products',
    new: () => '/products/new',
    bulkEdit: (productIds: string[]) => `/products/bulk-edit?ids=${productIds.map(id).join(',')}`,
    /** Write with AI for many products: a new run for `ids`, or the run `job`. */
    bulkWrite: ({ ids, job, fields, from }: BulkWriteTarget) => {
      const q = new URLSearchParams()
      if (ids?.length) q.set('ids', ids.join(','))
      if (job) q.set('job', job)
      if (fields?.length) q.set('fields', fields.join(','))
      if (from && from !== 'products') q.set('from', from)
      const s = q.toString()
      return s ? `/products/bulk-write?${s}` : '/products/bulk-write'
    },
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
    bulkEdit: () => '/customers/bulk-edit',
    segments: () => '/customers/segments',
    newSegment: () => '/customers/segments/new',
    segment: (segmentId: string) => `/customers/segments/${id(segmentId)}`,
  },

  content: {
    home: () => '/content',
    files: () => '/content/files',
    /** One file's page; `query` and `type` keep the library's filter for its previous / next. */
    file: (fileId: string, filter?: { query?: string | null; type?: string | null }) => {
      const params = new URLSearchParams()
      if (filter?.query) params.set('query', filter.query)
      if (filter?.type) params.set('type', filter.type)
      const qs = params.toString()
      return `/content/files/${id(fileId)}${qs ? `?${qs}` : ''}`
    },
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
    query: () => '/analytics/reports/query',
  },

  growth: {
    home: () => '/growth',
    attribution: () => '/growth/attribution',
    autopilot: () => '/growth/autopilot',
    campaigns: () => '/growth/campaigns',
    /** The Campaigns page's Tracking links tab (`/growth/links` redirects here). */
    trackingLinks: () => '/growth/campaigns?tab=links',
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
    /** Edit code: the theme's files (an imported theme's Liquid, a native theme's JSON). */
    themeCode: (themeId: string) => `/online-store/themes/${id(themeId)}/code`,
    themeImportNew: () => '/online-store/themes/import',
    themeImport: (themeId: string) => `/online-store/themes/${id(themeId)}/import`,
    pages: () => '/online-store/pages',
    page: (pageId: string) => `/online-store/pages/${id(pageId)}`,
    pageContent: (pageId: string) => `/online-store/pages/${id(pageId)}/content`,
    blog: () => '/online-store/blog',
    preferences: () => '/online-store/preferences',
    seo: () => '/online-store/seo',
  },

  salesChannels: {
    agentic: () => '/sales-channels/agentic',
    agenticReadiness: () => '/sales-channels/agentic/readiness',
    agenticControls: () => '/sales-channels/agentic/controls',
    social: () => '/sales-channels/social',
    /** The Inbox app's channel: conversations, quick replies and settings. */
    inbox: () => '/sales-channels/inbox',
    inboxConversations: () => '/sales-channels/inbox/conversations',
    /** One conversation open in the inbox (and the tab it sits in). */
    inboxConversation: (conversationId: string, view?: string) =>
      `/sales-channels/inbox/conversations?id=${id(conversationId)}${view ? `&view=${id(view)}` : ''}`,
    inboxQuickReplies: () => '/sales-channels/inbox/quick-replies',
    inboxSettings: () => '/sales-channels/inbox/settings',
    /** Facebook, Instagram and WhatsApp share one Meta page, a tab each. */
    socialMeta: () => '/sales-channels/social/meta',
    socialChannel: (channel: string) =>
      META_SURFACES.includes(channel)
        ? `/sales-channels/social/meta?surface=${id(channel)}`
        : `/sales-channels/social/${id(channel)}`,
  },

  apps: {
    list: () => '/apps',
    /**
     * The install flow for one app: where the App Store website's Install button lands
     * (`appStoreUrl` in `@commerce/config/site` is the store itself, outside the admin).
     */
    install: (pluginId: string, storeId?: string) =>
      `/apps/install?app=${encodeURIComponent(pluginId)}${storeId ? `&store=${encodeURIComponent(storeId)}` : ''}`,
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
    expenses: () => '/settings/expenses',
    locations: () => '/settings/locations',
    location: (locationId: string) => `/settings/locations/${id(locationId)}`,
    domains: () => '/settings/domains',
    domain: (domainId: string) => `/settings/domains/${id(domainId)}`,
    markets: () => '/settings/markets',
    notifications: () => '/settings/notifications',
    policies: () => '/settings/policies',
    /** Setups that break or hurt checkout and orders, each with a link to fix it. */
    storeHealth: () => '/settings/store-health',
    policy: (type: string) => `/settings/policies/${id(type)}`,
    privacy: () => '/settings/privacy',
    privacyBanner: () => '/settings/privacy#banner',
    privacyRequests: () => '/settings/privacy/requests',
    privacyRequest: (requestId: string) => `/settings/privacy/requests/${id(requestId)}`,
    customerAccounts: () => '/settings/customer-accounts',
    customData: () => '/settings/custom-data',
    /** One kind of record's extra fields (`products`, `blog-posts`, `store`…). */
    customDataOwner: (slug: string) => `/settings/custom-data/${id(slug)}`,
    returns: () => '/settings/returns',
    staff: () => '/settings/staff',
    /** Settings → Staff on its Roles tab. */
    staffRoles: () => '/settings/staff?tab=section-roles',
    newRole: () => '/settings/staff/roles/new',
    role: (roleId: string) => `/settings/staff/roles/${id(roleId)}`,
    ai: () => '/settings/ai',
    appearance: () => '/settings/appearance',
    billing: () => '/settings/billing',
    /** Settings → MCP & API; `activity` is its full activity log. */
    mcp: (page?: 'activity') => (page ? `/settings/mcp/${page}` : '/settings/mcp'),
  },

  dev: {
    editor: () => '/dev/editor',
    emails: () => '/dev/emails',
    email: (template: string) => `/dev/emails/${id(template)}`,
  },
} as const
