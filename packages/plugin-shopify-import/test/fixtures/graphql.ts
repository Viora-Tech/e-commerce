/**
 * Admin GraphQL responses shaped like Shopify's (2025-07), keyed by operation
 * name and page cursor. Two product pages exercise pagination; the second
 * product's variants run past the first page to exercise the nested fetch.
 */

const pageInfo = (endCursor: string | null) => ({ hasNextPage: endCursor !== null, endCursor })
const money = (amount: string) => ({ shopMoney: { amount } })

const variant = (id: string, sku: string, colour: string, qty: number) => ({
  id: `gid://shopify/ProductVariant/${id}`,
  title: colour,
  sku,
  barcode: null,
  price: '1499.00',
  compareAtPrice: '1999.00',
  taxable: true,
  inventoryQuantity: qty,
  selectedOptions: [{ name: 'Colour', value: colour }],
  image: null,
  inventoryItem: {
    tracked: true,
    harmonizedSystemCode: '851830',
    unitCost: { amount: '700.00' },
    measurement: { weight: { unit: 'KILOGRAMS', value: 0.25 } },
  },
})

export const PRODUCT_PAGES: Record<string, unknown> = {
  first: {
    products: {
      pageInfo: pageInfo('p1'),
      nodes: [
        {
          id: 'gid://shopify/Product/1',
          handle: 'aria-headset',
          title: 'Aria Headset',
          descriptionHtml:
            '<h2>Sound</h2><p>Closed back.</p><img src="https://cdn.shopify.com/body.png" alt="Diagram">',
          vendor: 'Waimers',
          productType: 'Audio',
          tags: ['audio'],
          templateSuffix: 'preorder',
          status: 'ACTIVE',
          seo: { title: 'Aria', description: null },
          options: [{ name: 'Colour', position: 1 }],
          hsn: null,
          media: {
            nodes: [
              {
                alt: 'Aria front',
                image: { url: 'https://cdn.shopify.com/aria.png?v=3', altText: null },
              },
              {},
            ],
          },
          variants: { pageInfo: pageInfo(null), nodes: [variant('11', 'ARIA-BLK', 'Black', 7)] },
        },
      ],
    },
  },
  p1: {
    products: {
      pageInfo: pageInfo(null),
      nodes: [
        {
          id: 'gid://shopify/Product/2',
          handle: 'keycaps',
          title: 'Keycaps',
          descriptionHtml: '',
          vendor: 'Waimers',
          productType: 'Keyboards',
          tags: ['sale'],
          status: 'DRAFT',
          seo: null,
          options: [{ name: 'Colour', position: 1 }],
          hsn: { value: '8473' },
          media: { nodes: [] },
          variants: { pageInfo: pageInfo('v1'), nodes: [variant('21', 'KEY-RED', 'Red', 1)] },
        },
      ],
    },
  },
}

export const VARIANT_PAGES: Record<string, unknown> = {
  v1: {
    product: {
      variants: {
        pageInfo: pageInfo(null),
        nodes: [
          {
            ...variant('22', 'KEY-BLU', 'Blue', 2),
            inventoryItem: {
              ...variant('22', '', '', 0).inventoryItem,
              harmonizedSystemCode: null,
            },
          },
        ],
      },
    },
  },
}

export const COLLECTIONS = {
  collections: {
    pageInfo: pageInfo(null),
    nodes: [
      {
        id: 'gid://shopify/Collection/1',
        handle: 'audio',
        title: 'Audio',
        descriptionHtml: '<p>Hear it.</p>',
        sortOrder: 'PRICE_ASC',
        image: null,
        seo: null,
        ruleSet: {
          appliedDisjunctively: false,
          rules: [
            { column: 'TYPE', relation: 'EQUALS', condition: 'Audio' },
            { column: 'VARIANT_PRICE', relation: 'GREATER_THAN', condition: '1000' },
          ],
        },
        products: { pageInfo: pageInfo(null), nodes: [{ handle: 'aria-headset' }] },
      },
      {
        id: 'gid://shopify/Collection/2',
        handle: 'in-stock',
        title: 'In stock',
        descriptionHtml: '',
        sortOrder: 'MANUAL',
        image: null,
        seo: null,
        ruleSet: {
          appliedDisjunctively: false,
          rules: [{ column: 'VARIANT_INVENTORY', relation: 'GREATER_THAN', condition: '0' }],
        },
        products: {
          pageInfo: pageInfo(null),
          nodes: [{ handle: 'keycaps' }, { handle: 'aria-headset' }],
        },
      },
      {
        id: 'gid://shopify/Collection/3',
        handle: 'staff-picks',
        title: 'Staff picks',
        descriptionHtml: '',
        sortOrder: 'MANUAL',
        templateSuffix: 'Gift Guide',
        image: { url: 'https://cdn.shopify.com/picks.png', altText: 'Picks' },
        seo: null,
        ruleSet: null,
        products: { pageInfo: pageInfo(null), nodes: [{ handle: 'keycaps' }] },
      },
    ],
  },
}

export const CUSTOMERS = {
  customers: {
    pageInfo: pageInfo(null),
    nodes: [
      {
        id: 'gid://shopify/Customer/9',
        email: 'Meera@Example.com',
        phone: '+919800000055',
        firstName: 'Meera',
        lastName: 'Iyer',
        tags: ['vip'],
        note: null,
        createdAt: '2024-01-05T10:00:00Z',
        emailMarketingConsent: { marketingState: 'SUBSCRIBED' },
        smsMarketingConsent: { marketingState: 'NOT_SUBSCRIBED' },
        defaultAddress: {
          firstName: 'Meera',
          lastName: 'Iyer',
          company: null,
          address1: '8 Beach Rd',
          address2: null,
          city: 'Chennai',
          province: 'Tamil Nadu',
          provinceCode: 'TN',
          country: 'India',
          countryCodeV2: 'IN',
          zip: '600001',
          phone: null,
        },
      },
    ],
  },
}

export const ORDERS = {
  orders: {
    pageInfo: pageInfo(null),
    nodes: [
      {
        id: 'gid://shopify/Order/500',
        name: '#2001',
        email: 'meera@example.com',
        phone: null,
        createdAt: '2025-06-01T08:00:00Z',
        cancelledAt: null,
        displayFinancialStatus: 'PAID',
        displayFulfillmentStatus: 'UNFULFILLED',
        currencyCode: 'INR',
        tags: [],
        note: null,
        paymentGatewayNames: ['razorpay'],
        discountCodes: [],
        subtotalPriceSet: money('2998.00'),
        totalShippingPriceSet: money('0.00'),
        totalTaxSet: money('457.32'),
        totalPriceSet: money('2998.00'),
        totalDiscountsSet: money('0.00'),
        totalRefundedSet: money('0.00'),
        customer: { firstName: 'Meera', lastName: 'Iyer' },
        shippingAddress: {
          name: 'Meera Iyer',
          company: null,
          address1: '8 Beach Rd',
          address2: null,
          city: 'Chennai',
          province: 'Tamil Nadu',
          provinceCode: 'TN',
          countryCodeV2: 'IN',
          zip: '600001',
          phone: '+919800000055',
        },
        lineItems: {
          nodes: [
            {
              title: 'Keycaps',
              variantTitle: 'Blue',
              sku: null,
              quantity: 2,
              taxable: true,
              unfulfilledQuantity: 2,
              originalUnitPriceSet: money('1499.00'),
              product: { handle: 'keycaps' },
            },
          ],
        },
      },
    ],
  },
}

export const PAGES = {
  pages: {
    pageInfo: pageInfo(null),
    nodes: [
      {
        id: 'gid://shopify/Page/1',
        handle: 'shipping-policy',
        title: 'Shipping policy',
        body: '<p>We ship in <em>2 days</em>.</p>',
        isPublished: true,
        publishedAt: '2024-02-01T00:00:00Z',
        templateSuffix: 'about',
        seoTitle: { value: 'Shipping' },
        seoDescription: null,
      },
    ],
  },
}

export const ARTICLES = {
  articles: {
    pageInfo: pageInfo(null),
    nodes: [
      {
        id: 'gid://shopify/Article/1',
        handle: 'launch_day',
        title: 'Launch day',
        body: '<p>We are live.</p>',
        summary: '<p>Live now.</p>',
        tags: ['news'],
        isPublished: true,
        publishedAt: '2025-01-01T00:00:00Z',
        author: { name: 'Kuldeep' },
        image: { url: 'https://cdn.shopify.com/launch.png', altText: 'Launch' },
        templateSuffix: 'notes',
        blog: { handle: 'journal', title: 'Journal', templateSuffix: 'series' },
        seoTitle: null,
        seoDescription: null,
      },
    ],
  },
}

export const MENUS = {
  menus: {
    pageInfo: pageInfo(null),
    nodes: [
      {
        id: 'gid://shopify/Menu/1',
        handle: 'main-menu',
        title: 'Main menu',
        items: [
          { title: 'Home', type: 'FRONTPAGE', url: '/', items: [] },
          {
            title: 'Shop',
            type: 'COLLECTION',
            url: '/collections/audio',
            items: [
              { title: 'Aria', type: 'PRODUCT', url: '/products/aria-headset', items: [] },
              { title: 'Shipping', type: 'PAGE', url: '/pages/shipping-policy', items: [] },
            ],
          },
          { title: 'Discord', type: 'HTTP', url: 'https://discord.gg/waimers', items: [] },
        ],
      },
    ],
  },
}

export const REDIRECTS = {
  urlRedirects: {
    pageInfo: pageInfo(null),
    nodes: [{ id: 'gid://shopify/UrlRedirect/1', path: '/old-sale', target: '/collections/audio' }],
  },
}

const stock = (id: string, qty: number) => ({
  id: `gid://shopify/ProductVariant/${id}`,
  inventoryQuantity: qty,
  inventoryItem: { tracked: true },
})

/** `productVariants` stock, read fresh when an import reuses a preview's products. */
export const VARIANT_STOCK = {
  productVariants: {
    pageInfo: pageInfo(null),
    nodes: [stock('11', 7), stock('21', 1), stock('22', 2)],
  },
}
