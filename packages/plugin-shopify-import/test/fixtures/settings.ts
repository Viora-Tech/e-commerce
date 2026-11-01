/**
 * Admin GraphQL answers for Store settings, shaped like Shopify's (2026-10): a shop in
 * Bengaluru with two locations and an app's fulfilment location, a general shipping
 * profile (flat, price bands, free over ₹999, weight bands in kilograms, a carrier rate,
 * an international zone) plus a product-specific profile, five policies and extra
 * field definitions on products, variants and customers, plus purchase orders and transfers.
 */

const cost = {
  requestedQueryCost: 10,
  throttleStatus: { maximumAvailable: 2000, currentlyAvailable: 1990, restoreRate: 100 },
}
const pageInfo = { hasNextPage: false, endCursor: null }

export const SHOP = {
  shop: {
    name: 'Waimers',
    email: 'owner@waimers.in',
    contactEmail: 'hello@waimers.in',
    currencyCode: 'INR',
    ianaTimezone: 'Asia/Kolkata',
    weightUnit: 'KILOGRAMS',
    taxesIncluded: true,
    currencyFormats: { moneyFormat: '<span class=money>Rs. {{amount}}</span>' },
    shopAddress: {
      address1: '12 MG Road',
      address2: 'Floor 3',
      city: 'Bengaluru',
      province: 'Karnataka',
      provinceCode: 'KA',
      countryCodeV2: 'IN',
      zip: '560001',
      phone: '+91 98765 43210',
    },
  },
}

/** An invoice app keeps the GSTIN on the shop; the other fields are noise. */
export const SHOP_FIELDS = {
  shop: {
    metafields: {
      nodes: [
        { namespace: 'custom', key: 'tagline', value: 'Play louder' },
        { namespace: 'gst_app', key: 'gstin', value: '29AAGCB7383J1Z4' },
        { namespace: 'global', key: 'title_tag', value: 'Waimers' },
        {
          namespace: 'global',
          key: 'description_tag',
          value: 'Premium gaming peripherals for India.',
        },
      ],
    },
  },
}

const address = (
  address1: string,
  city: string,
  province: string,
  provinceCode: string,
  zip: string,
) => ({
  address1,
  address2: null,
  city,
  province,
  provinceCode,
  countryCode: 'IN',
  zip,
  phone: null,
})

export const LOCATIONS = {
  locations: {
    pageInfo,
    nodes: [
      {
        id: 'gid://shopify/Location/1',
        name: 'Bengaluru warehouse',
        isActive: true,
        fulfillsOnlineOrders: true,
        isFulfillmentService: false,
        address: address('Plot 4, KIADB', 'Bengaluru', 'Karnataka', 'KA', '560099'),
        localPickupSettingsV2: { pickupTime: 'TWO_HOURS' },
      },
      {
        id: 'gid://shopify/Location/2',
        name: 'Delhi store',
        isActive: true,
        fulfillsOnlineOrders: false,
        isFulfillmentService: false,
        address: address('8 Connaught Place', 'New Delhi', 'Delhi', 'DL', '1100 01'),
        localPickupSettingsV2: null,
      },
      {
        id: 'gid://shopify/Location/3',
        name: 'Old godown',
        isActive: false,
        fulfillsOnlineOrders: false,
        isFulfillmentService: false,
        address: address('Somewhere', 'Pune', 'Maharashtra', 'MH', '411001'),
        localPickupSettingsV2: null,
      },
      {
        id: 'gid://shopify/Location/4',
        name: 'Amazon MCF',
        isActive: true,
        fulfillsOnlineOrders: true,
        isFulfillmentService: true,
        address: address('', '', '', '', ''),
        localPickupSettingsV2: null,
      },
    ],
  },
}

export const PROFILES = {
  deliveryProfiles: {
    pageInfo,
    nodes: [
      { id: 'gid://shopify/DeliveryProfile/1', name: 'General profile', default: true },
      { id: 'gid://shopify/DeliveryProfile/2', name: 'Heavy chairs', default: false },
    ],
  },
}

const flat = (id: string, name: string, amount: string, conditions: unknown[] = []) => ({
  id: `gid://shopify/DeliveryMethodDefinition/${id}`,
  name,
  active: true,
  rateProvider: {
    __typename: 'DeliveryRateDefinition',
    price: { amount, currencyCode: 'INR' },
  },
  methodConditions: conditions,
})

const price = (operator: string, amount: string) => ({
  field: 'TOTAL_PRICE',
  operator,
  conditionCriteria: { __typename: 'MoneyV2', amount, currencyCode: 'INR' },
})

const weight = (operator: string, value: number) => ({
  field: 'TOTAL_WEIGHT',
  operator,
  conditionCriteria: { __typename: 'Weight', unit: 'KILOGRAMS', value },
})

/** The custom profile's products: two the products import brought over, one it did not. */
export const PROFILE_ITEMS = {
  deliveryProfile: {
    profileItems: {
      pageInfo,
      nodes: [
        { product: { id: 'gid://shopify/Product/11' } },
        { product: { id: 'gid://shopify/Product/12' } },
        { product: { id: 'gid://shopify/Product/13' } },
      ],
    },
  },
}

/** The custom profile's one zone: all of India at ₹299. */
export const HEAVY_ZONES = {
  deliveryProfile: {
    profileLocationGroups: [
      {
        locationGroup: { id: 'gid://shopify/DeliveryLocationGroup/2' },
        locationGroupZones: {
          pageInfo,
          nodes: [
            {
              zone: {
                id: 'gid://shopify/DeliveryZone/20',
                name: 'Heavy India',
                countries: [{ code: { countryCode: 'IN', restOfWorld: false }, provinces: [] }],
              },
              methodDefinitions: { nodes: [flat('20', 'Freight', '299.00')] },
            },
          ],
        },
      },
    ],
  },
}

export const PROFILE_ZONES = {
  deliveryProfile: {
    profileLocationGroups: [
      {
        locationGroup: { id: 'gid://shopify/DeliveryLocationGroup/1' },
        locationGroupZones: {
          pageInfo,
          nodes: [
            {
              zone: {
                id: 'gid://shopify/DeliveryZone/1',
                name: 'South India',
                countries: [
                  {
                    code: { countryCode: 'IN', restOfWorld: false },
                    provinces: [
                      { name: 'Karnataka', code: 'KA' },
                      { name: 'Tamil Nadu', code: 'TN' },
                      { name: 'Kerala', code: 'KL' },
                    ],
                  },
                ],
              },
              methodDefinitions: {
                nodes: [
                  flat('1', 'Standard', '49.00', [price('LESS_THAN_OR_EQUAL_TO', '998.99')]),
                  flat('2', 'Free shipping', '0.00', [price('GREATER_THAN_OR_EQUAL_TO', '999.00')]),
                  {
                    ...flat('3', 'Old rate', '10.00'),
                    active: false,
                  },
                  {
                    id: 'gid://shopify/DeliveryMethodDefinition/4',
                    name: 'Shiprocket live',
                    active: true,
                    rateProvider: {
                      __typename: 'DeliveryParticipant',
                      carrierService: { name: 'Shiprocket' },
                    },
                    methodConditions: [],
                  },
                ],
              },
            },
            {
              zone: {
                id: 'gid://shopify/DeliveryZone/2',
                name: 'Rest of India',
                countries: [{ code: { countryCode: 'IN', restOfWorld: false }, provinces: [] }],
              },
              methodDefinitions: {
                nodes: [
                  flat('5', 'Light', '60.00', [weight('LESS_THAN_OR_EQUAL_TO', 0.5)]),
                  flat('6', 'Heavy', '120.00', [weight('GREATER_THAN_OR_EQUAL_TO', 0.5)]),
                  flat('7', 'Odd', '80.00', [
                    weight('GREATER_THAN_OR_EQUAL_TO', 1),
                    price('LESS_THAN_OR_EQUAL_TO', '500.00'),
                  ]),
                ],
              },
            },
            {
              zone: {
                id: 'gid://shopify/DeliveryZone/3',
                name: 'International',
                countries: [{ code: { countryCode: null, restOfWorld: true }, provinces: [] }],
              },
              methodDefinitions: { nodes: [flat('8', 'World', '1500.00')] },
            },
          ],
        },
      },
    ],
  },
}

export const POLICIES = {
  shop: {
    shopPolicies: [
      {
        type: 'REFUND_POLICY',
        title: 'Refund policy',
        body: '<h2>Returns</h2><p>Within <strong>7 days</strong>.</p><script>alert(1)</script><p style="color:red">Unused only.</p><img src="https://cdn.shopify.com/s/files/box.png">',
      },
      { type: 'PRIVACY_POLICY', title: 'Privacy policy', body: '<p>We keep your data safe.</p>' },
      { type: 'TERMS_OF_SERVICE', title: 'Terms of service', body: '<p>Be nice.</p>' },
      { type: 'LEGAL_NOTICE', title: 'Legal notice', body: '<p>Imprint.</p>' },
      { type: 'SHIPPING_POLICY', title: 'Shipping policy', body: '   ' },
    ],
  },
}

const def = (id: string, namespace: string, key: string, name: string, type: string) => ({
  id: `gid://shopify/MetafieldDefinition/${id}`,
  namespace,
  key,
  name,
  description: null,
  metafieldsCount: 3,
  type: { name: type },
  validations: [],
})

export const FIELD_DEFINITIONS: Record<string, unknown[]> = {
  PRODUCT: [
    def('1', 'custom', 'warranty_months', 'Warranty (months)', 'number_integer'),
    def('2', 'custom', 'price_per_kg', 'Price per kg', 'money'),
    def('3', 'global', 'title_tag', 'SEO title', 'single_line_text_field'),
    def('4', 'custom', 'colour', 'Colour', 'single_line_text_field'),
  ],
  PRODUCTVARIANT: [def('5', 'custom', 'size_chart', 'Size chart', 'url')],
  COLLECTION: [],
  CUSTOMER: [def('6', 'custom', 'birthday', 'Birthday', 'date')],
  ORDER: [],
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(status === 200 ? { data, extensions: { cost } } : data), {
    status,
    headers: { 'content-type': 'application/json' },
  })

/** Waimers' segments: two our rules can express, one that filters by products bought. */
export const SEGMENTS = {
  segments: {
    pageInfo,
    nodes: [
      {
        id: 'gid://shopify/Segment/1',
        name: 'Restock list: Mio',
        query: "customer_tags CONTAINS 'restock-dysphoria-mio'",
      },
      {
        id: 'gid://shopify/Segment/2',
        name: 'Email subscribers',
        query: "email_subscription_status = 'SUBSCRIBED'",
      },
      {
        id: 'gid://shopify/Segment/3',
        name: 'Bought TenZ',
        query: 'products_purchased(id: 1234) = true',
      },
    ],
  },
}

const market = (
  id: number,
  name: string,
  status: 'ACTIVE' | 'DRAFT',
  codes: string[],
  currency: string,
  subfolder: string | null,
  adjustment: { type: string; value: number } | null = null,
) => ({
  id: `gid://shopify/Market/${id}`,
  name,
  status,
  conditions: { regionsCondition: { regions: { nodes: codes.map((code) => ({ code })) } } },
  currencySettings: { baseCurrency: { currencyCode: currency } },
  webPresences: {
    nodes: [
      {
        subfolderSuffix: subfolder,
        defaultLocale: { locale: 'en' },
        alternateLocales: [{ locale: 'fr' }, { locale: 'xx' }],
      },
    ],
  },
  catalogs: { nodes: adjustment ? [{ priceList: { parent: { adjustment } } }] : [] },
})

/** Waimers' markets on Shopify: India live, the rest drafts (audit #114). */
export const MARKETS = {
  markets: {
    pageInfo,
    nodes: [
      market(1, 'India', 'ACTIVE', ['IN'], 'INR', null),
      market(2, 'United States', 'DRAFT', ['US'], 'USD', 'us', {
        type: 'PERCENTAGE_INCREASE',
        value: 10,
      }),
      market(3, 'European Union', 'DRAFT', ['DE', 'FR', 'IT'], 'EUR', 'eu'),
      market(4, 'United Kingdom', 'DRAFT', ['GB'], 'GBP', 'en-gb', {
        type: 'PERCENTAGE_DECREASE',
        value: 5,
      }),
      market(5, 'Canada', 'DRAFT', ['CA'], 'CAD', null),
    ],
  },
}

/** A purchase order or transfer line: `variantTitle` null means a product with no options. */
const stockLine = (
  product: number,
  sku: string | null,
  variantTitle: string,
  quantity: number,
  unitCost: string | null,
) => ({
  totalQuantity: quantity,
  title: `Product ${product}`,
  ...(unitCost === null ? {} : { unitCost: { amount: unitCost } }),
  inventoryItem: {
    variant: { sku, title: variantTitle, product: { id: `gid://shopify/Product/${product}` } },
  },
})

const snapshot = (id: number | null, name: string) => ({
  name,
  location: id === null ? null : { id: `gid://shopify/Location/${id}` },
})

/**
 * Waimers' purchase orders (API 2026-10): PO #1 from Kyomi, ₹65,000, ordered (audit #75);
 * a draft in US dollars; and one for a product not imported here.
 */
export const PURCHASE_ORDERS = {
  inventoryPurchaseOrders: {
    pageInfo,
    nodes: [
      {
        id: 'gid://shopify/InventoryPurchaseOrder/1',
        name: '#PO1',
        status: 'ORDERED',
        currency: 'INR',
        orderedAt: '2026-10-20T10:00:00Z',
        archivedAt: null,
        origin: { supplierName: 'Kyomi' },
        destination: snapshot(1, 'Bengaluru warehouse'),
        transfers: { nodes: [] },
        lineItems: {
          pageInfo,
          nodes: [
            stockLine(11, 'MIO-BLK', 'Black', 50, '1000.00'),
            stockLine(12, null, 'Default Title', 10, '1500.00'),
          ],
        },
      },
      {
        id: 'gid://shopify/InventoryPurchaseOrder/2',
        name: '#PO2',
        status: 'DRAFT',
        currency: 'USD',
        orderedAt: null,
        archivedAt: null,
        origin: { supplierName: 'Shenzhen Pads' },
        destination: snapshot(1, 'Bengaluru warehouse'),
        transfers: { nodes: [] },
        lineItems: { pageInfo, nodes: [stockLine(11, 'MIO-WHT', 'White', 5, '12.50')] },
      },
      {
        id: 'gid://shopify/InventoryPurchaseOrder/3',
        name: '#PO3',
        status: 'DRAFT',
        currency: 'INR',
        orderedAt: null,
        archivedAt: null,
        origin: { supplierName: 'kyomi ' },
        destination: snapshot(2, 'Delhi store'),
        transfers: { nodes: [] },
        lineItems: {
          pageInfo,
          nodes: [
            stockLine(11, 'MIO-WHT', 'White', 2, '1000.00'),
            stockLine(99, 'GONE', 'Default Title', 1, '10.00'),
          ],
        },
      },
    ],
  },
}

/** Waimers' transfers: #T0001 on its way to Delhi, a cancelled one, a purchase order's receipt. */
export const TRANSFERS = {
  inventoryTransfers: {
    pageInfo,
    nodes: [
      {
        id: 'gid://shopify/InventoryTransfer/1',
        name: '#T0001',
        status: 'IN_PROGRESS',
        note: 'Diwali stock for the store',
        dateCreated: '2026-10-22T09:00:00Z',
        origin: snapshot(1, 'Bengaluru warehouse'),
        destination: snapshot(2, 'Delhi store'),
        lineItems: {
          pageInfo,
          nodes: [
            stockLine(11, 'MIO-BLK', 'Black', 3, null),
            stockLine(11, 'mio-blk', 'Black', 2, null),
          ],
        },
      },
      {
        id: 'gid://shopify/InventoryTransfer/2',
        name: '#T0002',
        status: 'CANCELED',
        note: null,
        dateCreated: '2026-10-23T09:00:00Z',
        origin: snapshot(1, 'Bengaluru warehouse'),
        destination: snapshot(2, 'Delhi store'),
        lineItems: { pageInfo, nodes: [stockLine(12, null, 'Default Title', 1, null)] },
      },
      {
        id: 'gid://shopify/InventoryTransfer/3',
        name: '#T0003',
        status: 'TRANSFERRED',
        note: null,
        dateCreated: '2026-10-24T09:00:00Z',
        origin: null,
        destination: snapshot(1, 'Bengaluru warehouse'),
        lineItems: { pageInfo, nodes: [stockLine(12, null, 'Default Title', 4, null)] },
      },
    ],
  },
}

/** A fake Admin API for the settings queries; `deny` lists the operations the token may not read. */
export function settingsShopify(deny: readonly string[] = [], log: string[] = []): typeof fetch {
  return (async (_input: string | URL | Request, init?: RequestInit) => {
    const { query, variables } = JSON.parse(String(init?.body)) as {
      query: string
      variables: { ownerType?: string; id?: string }
    }
    const op = query.includes('inventoryPurchaseOrders(')
      ? 'purchaseOrders'
      : query.includes('inventoryTransfers(')
        ? 'transfers'
        : query.includes('markets(')
          ? 'markets'
          : query.includes('segments(')
            ? 'segments'
            : query.includes('shopPolicies')
              ? 'policies'
              : query.includes('metafields(first')
                ? 'shopFields'
                : query.includes('locations(')
                  ? 'locations'
                  : query.includes('deliveryProfiles(')
                    ? 'profiles'
                    : query.includes('profileItems(')
                      ? 'items'
                      : query.includes('deliveryProfile(')
                        ? 'zones'
                        : query.includes('metafieldDefinitions(')
                          ? `fields:${variables.ownerType}`
                          : 'shop'
    log.push(variables.id ? `${op}:${variables.id}` : op)
    if (deny.some((d) => op === d || op.startsWith(`${d}:`))) {
      return new Response(
        JSON.stringify({
          errors: [{ message: 'Access denied', extensions: { code: 'ACCESS_DENIED' } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }
    if (op === 'shop') return json(SHOP)
    if (op === 'shopFields') return json(SHOP_FIELDS)
    if (op === 'locations') return json(LOCATIONS)
    if (op === 'profiles') return json(PROFILES)
    if (op === 'items') return json(PROFILE_ITEMS)
    if (op === 'zones') {
      return json(variables.id === 'gid://shopify/DeliveryProfile/2' ? HEAVY_ZONES : PROFILE_ZONES)
    }
    if (op === 'policies') return json(POLICIES)
    if (op === 'segments') return json(SEGMENTS)
    if (op === 'markets') return json(MARKETS)
    if (op === 'purchaseOrders') return json(PURCHASE_ORDERS)
    if (op === 'transfers') return json(TRANSFERS)
    const owner = variables.ownerType ?? ''
    return json({ metafieldDefinitions: { pageInfo, nodes: FIELD_DEFINITIONS[owner] ?? [] } })
  }) as typeof fetch
}
