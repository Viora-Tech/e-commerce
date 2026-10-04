/**
 * Admin GraphQL answers for the "import everything" resources (2025-07
 * shapes): Files, metaobject definitions and entries, product and collection
 * metafields, discounts and gift cards. Ids line up with `graphql.ts`
 * (Product/1 aria-headset, Product/2 keycaps, Collection/1 audio,
 * Collection/3 staff-picks, Customer/9 Meera).
 */

const pageInfo = { hasNextPage: false, endCursor: null }
const page = <T>(nodes: T[]) => ({ pageInfo, nodes })

export const FILES = {
  files: page([
    {
      __typename: 'MediaImage',
      id: 'gid://shopify/MediaImage/100',
      alt: 'Festive banner',
      fileStatus: 'READY',
      mimeType: 'image/png',
      image: { url: 'https://cdn.shopify.com/files/banner.png?v=9' },
      originalSource: { fileSize: 2048 },
    },
    {
      __typename: 'GenericFile',
      id: 'gid://shopify/GenericFile/101',
      alt: '',
      fileStatus: 'READY',
      url: 'https://cdn.shopify.com/files/size-chart.pdf',
      mimeType: 'application/pdf',
      originalFileSize: 90_000,
    },
    {
      __typename: 'Video',
      id: 'gid://shopify/Video/102',
      alt: 'Hero',
      fileStatus: 'READY',
      originalSource: {
        url: 'https://cdn.shopify.com/videos/hero.mov',
        mimeType: 'video/quicktime',
        fileSize: 300_000_000,
      },
      sources: [
        {
          url: 'https://cdn.shopify.com/videos/hero-1080.mp4',
          mimeType: 'video/mp4',
          fileSize: 200_000_000,
        },
        {
          url: 'https://cdn.shopify.com/videos/hero-720.mp4',
          mimeType: 'video/mp4',
          fileSize: 5_000_000,
        },
      ],
    },
    {
      __typename: 'ExternalVideo',
      id: 'gid://shopify/ExternalVideo/103',
      alt: null,
      fileStatus: 'READY',
      originUrl: 'https://www.youtube.com/watch?v=abc',
    },
    {
      __typename: 'MediaImage',
      id: 'gid://shopify/MediaImage/104',
      alt: null,
      fileStatus: 'PROCESSING',
      mimeType: 'image/jpeg',
      image: null,
      originalSource: null,
    },
  ]),
}

const field = (
  key: string,
  type: string,
  extra: { name?: string; validations?: { name: string; value: string }[] } = {},
) => ({
  key,
  name: extra.name ?? key,
  description: null,
  required: false,
  type: { name: type },
  validations: extra.validations ?? [],
})

export const METAOBJECT_DEFINITIONS = {
  metaobjectDefinitions: page([
    {
      id: 'gid://shopify/MetaobjectDefinition/1',
      type: 'size-chart',
      name: 'Size chart',
      description: 'Measurements per product type',
      displayNameKey: 'title',
      access: { storefront: 'PUBLIC_READ' },
      fieldDefinitions: [
        field('title', 'single_line_text_field', { name: 'Title' }),
        field('chart', 'file_reference', { name: 'Chart' }),
        field('notes', 'rich_text_field', { name: 'Notes' }),
        field('price', 'money', { name: 'Price' }),
        field('related', 'list.metaobject_reference', {
          name: 'Designers',
          validations: [
            { name: 'metaobject_definition_id', value: 'gid://shopify/MetaobjectDefinition/2' },
          ],
        }),
        field('product', 'product_reference', { name: 'Product' }),
      ],
    },
    {
      id: 'gid://shopify/MetaobjectDefinition/2',
      type: 'designer',
      name: 'Designer',
      description: null,
      displayNameKey: 'name',
      access: { storefront: 'NONE' },
      fieldDefinitions: [
        field('name', 'single_line_text_field', { name: 'Name' }),
        field('bio', 'multi_line_text_field', { name: 'Bio' }),
        field('born', 'date_time', { name: 'Born' }),
      ],
    },
  ]),
}

export const RICH = JSON.stringify({
  type: 'root',
  children: [
    {
      type: 'paragraph',
      children: [
        { type: 'text', value: 'Measure ' },
        { type: 'text', value: 'flat', bold: true },
      ],
    },
    {
      type: 'list',
      listType: 'unordered',
      children: [{ type: 'list-item', children: [{ type: 'text', value: 'Chest' }] }],
    },
  ],
})

export const METAOBJECTS: Record<string, unknown> = {
  'size-chart': {
    metaobjects: page([
      {
        id: 'gid://shopify/Metaobject/20',
        handle: 'tees',
        displayName: 'Tees',
        capabilities: { publishable: { status: 'ACTIVE' } },
        fields: [
          { key: 'title', type: 'single_line_text_field', value: 'Tees' },
          { key: 'chart', type: 'file_reference', value: 'gid://shopify/MediaImage/100' },
          { key: 'notes', type: 'rich_text_field', value: RICH },
          { key: 'price', type: 'money', value: '{"amount":"5.00","currency_code":"INR"}' },
          {
            key: 'related',
            type: 'list.metaobject_reference',
            value: '["gid://shopify/Metaobject/21"]',
          },
          { key: 'product', type: 'product_reference', value: 'gid://shopify/Product/1' },
        ],
      },
    ]),
  },
  designer: {
    metaobjects: page([
      {
        id: 'gid://shopify/Metaobject/21',
        handle: 'asha',
        displayName: 'Asha',
        capabilities: { publishable: { status: 'DRAFT' } },
        fields: [
          { key: 'name', type: 'single_line_text_field', value: 'Asha' },
          { key: 'bio', type: 'multi_line_text_field', value: 'Weaver.\nChennai.' },
          { key: 'born', type: 'date_time', value: '1990-04-05T10:00:00Z' },
        ],
      },
    ]),
  },
}

const mfDef = (
  id: string,
  namespace: string,
  key: string,
  type: string,
  validations: { name: string; value: string }[] = [],
  metafieldsCount = 1,
) => ({
  id: `gid://shopify/MetafieldDefinition/${id}`,
  namespace,
  key,
  metafieldsCount,
  name: key.replace(/-/g, ' '),
  description: null,
  type: { name: type },
  validations,
})

export const METAFIELD_DEFINITIONS: Record<string, unknown> = {
  PRODUCT: {
    metafieldDefinitions: page([
      mfDef('1', 'custom', 'material', 'single_line_text_field', [
        { name: 'choices', value: '["Cotton","Linen"]' },
      ]),
      mfDef('2', 'custom', 'size-guide', 'metaobject_reference', [
        { name: 'metaobject_definition_id', value: 'gid://shopify/MetaobjectDefinition/1' },
      ]),
      mfDef('3', 'custom', 'care', 'rich_text_field'),
    ]),
  },
  COLLECTION: { metafieldDefinitions: page([]) },
  CUSTOMER: {
    metafieldDefinitions: page([
      mfDef('7', 'custom', 'birthday', 'date', [], 30),
      mfDef('8', 'custom', 'size', 'single_line_text_field', [], 10),
    ]),
  },
  PRODUCTVARIANT: {
    metafieldDefinitions: page([mfDef('9', 'custom', 'fabric', 'single_line_text_field', [], 12)]),
  },
}

const mf = (namespace: string, key: string, type: string, value: string) => ({
  namespace,
  key,
  type,
  value,
})

export const PRODUCT_METAFIELDS = {
  products: page([
    {
      id: 'gid://shopify/Product/1',
      handle: 'aria-headset',
      metafields: page([
        mf('custom', 'material', 'single_line_text_field', 'Cotton'),
        mf('custom', 'size-guide', 'metaobject_reference', 'gid://shopify/Metaobject/20'),
        mf('custom', 'care', 'rich_text_field', RICH),
        mf('reviews', 'rating', 'rating', '{"value":"4.5","scale_min":"1","scale_max":"5"}'),
        mf('global', 'title_tag', 'single_line_text_field', 'Aria'),
        mf('custom', 'launch', 'date', '2026-10-01'),
      ]),
    },
    {
      id: 'gid://shopify/Product/2',
      handle: 'keycaps',
      metafields: page([mf('custom', 'material', 'single_line_text_field', 'Wool')]),
    },
  ]),
}

export const COLLECTION_METAFIELDS = {
  collections: page([
    {
      id: 'gid://shopify/Collection/3',
      handle: 'staff-picks',
      metafields: page([mf('custom', 'banner', 'file_reference', 'gid://shopify/MediaImage/100')]),
    },
  ]),
}

const basic = (over: Record<string, unknown>) => ({
  __typename: 'DiscountCodeBasic',
  title: 'Discount',
  status: 'ACTIVE',
  startsAt: '2026-01-01T00:00:00Z',
  endsAt: null,
  asyncUsageCount: 0,
  usageLimit: null,
  appliesOncePerCustomer: false,
  customerSelection: { __typename: 'DiscountCustomerAll' },
  codes: page([]),
  customerGets: {
    value: { __typename: 'DiscountPercentage', percentage: 0.1 },
    items: { __typename: 'AllDiscountItems' },
  },
  minimumRequirement: null,
  ...over,
})

export const DISCOUNTS = {
  discountNodes: page([
    {
      id: 'gid://shopify/DiscountCodeNode/1',
      discount: basic({
        title: 'WELCOME10',
        asyncUsageCount: 4,
        usageLimit: 100,
        appliesOncePerCustomer: true,
        codes: page([{ code: 'WELCOME10', asyncUsageCount: 4 }]),
        minimumRequirement: {
          __typename: 'DiscountMinimumSubtotal',
          greaterThanOrEqualToSubtotal: { amount: '999.0' },
        },
      }),
    },
    {
      id: 'gid://shopify/DiscountAutomaticNode/2',
      discount: basic({
        __typename: 'DiscountAutomaticBasic',
        title: 'Audio ₹200 off',
        customerSelection: undefined,
        codes: undefined,
        customerGets: {
          value: {
            __typename: 'DiscountAmount',
            amount: { amount: '200.0' },
            appliesOnEachItem: false,
          },
          items: {
            __typename: 'DiscountCollections',
            collections: page([{ id: 'gid://shopify/Collection/1' }]),
          },
        },
      }),
    },
    {
      id: 'gid://shopify/DiscountCodeNode/3',
      discount: {
        __typename: 'DiscountCodeBxgy',
        title: 'B2G1',
        status: 'ACTIVE',
        startsAt: '2026-01-01T00:00:00Z',
        endsAt: null,
        asyncUsageCount: 0,
        codes: page([{ code: 'B2G1', asyncUsageCount: 0 }]),
      },
    },
    {
      id: 'gid://shopify/DiscountCodeNode/4',
      discount: basic({
        title: 'VIP',
        codes: page([
          { code: 'VIP-A', asyncUsageCount: 1 },
          { code: 'VIP B', asyncUsageCount: 0 },
        ]),
        customerGets: {
          value: { __typename: 'DiscountPercentage', percentage: 0.15 },
          items: {
            __typename: 'DiscountProducts',
            products: page([
              { id: 'gid://shopify/Product/2' },
              { id: 'gid://shopify/Product/999' },
            ]),
            productVariants: { nodes: [] },
          },
        },
      }),
    },
    {
      id: 'gid://shopify/DiscountCodeNode/5',
      discount: basic({
        __typename: 'DiscountCodeFreeShipping',
        title: 'SHIPFREE',
        codes: page([{ code: 'SHIPFREE', asyncUsageCount: 0 }]),
        customerGets: undefined,
        minimumRequirement: {
          __typename: 'DiscountMinimumSubtotal',
          greaterThanOrEqualToSubtotal: { amount: '500.0' },
        },
        destinationSelection: { __typename: 'DiscountCountryAll' },
        maximumShippingPrice: null,
      }),
    },
    {
      id: 'gid://shopify/DiscountCodeNode/6',
      discount: basic({
        title: 'SEGMENT',
        codes: page([{ code: 'SEGMENT', asyncUsageCount: 0 }]),
        customerSelection: { __typename: 'DiscountCustomerSegments' },
      }),
    },
  ]),
}

/** Mutable so a test can move a balance between runs. */
export const giftCards = (balanceOne = '500.00') => ({
  giftCards: page([
    {
      id: 'gid://shopify/GiftCard/1',
      lastCharacters: 'ab12',
      enabled: true,
      expiresOn: null,
      note: 'Diwali gift',
      balance: { amount: balanceOne, currencyCode: 'INR' },
      initialValue: { amount: '1000.00' },
      customer: {
        id: 'gid://shopify/Customer/9',
        email: 'meera@example.com',
        firstName: 'Meera',
        lastName: 'Iyer',
      },
    },
    {
      id: 'gid://shopify/GiftCard/2',
      lastCharacters: 'cd34',
      enabled: true,
      expiresOn: null,
      note: null,
      balance: { amount: '300.00', currencyCode: 'INR' },
      initialValue: { amount: '300.00' },
      customer: null,
    },
    {
      id: 'gid://shopify/GiftCard/3',
      lastCharacters: 'ef56',
      enabled: true,
      expiresOn: null,
      note: null,
      balance: { amount: '0.00', currencyCode: 'INR' },
      initialValue: { amount: '500.00' },
      customer: null,
    },
    {
      id: 'gid://shopify/GiftCard/4',
      lastCharacters: 'gh78',
      enabled: false,
      expiresOn: null,
      note: null,
      balance: { amount: '100.00', currencyCode: 'INR' },
      initialValue: { amount: '100.00' },
      customer: null,
    },
  ]),
})
